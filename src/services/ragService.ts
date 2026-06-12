import * as FileSystem from "expo-file-system";
import { decode } from "base64-arraybuffer";
import { supabase } from "../lib/supabase";

// ── Types ──────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface MedicalDocument {
  id: string;
  user_id: string;
  name: string;
  storage_path: string;
  page_count: number | null;
  created_at: string;
}

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? "";
const BUCKET_NAME = "medical_documents";

// ── Storage ────────────────────────────────────────────

export async function ensureBucketExists(): Promise<void> {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BUCKET_NAME);

  if (!exists) {
    await supabase.storage.createBucket(BUCKET_NAME, {
      public: false,
      allowedMimeTypes: ["application/pdf"],
      fileSizeLimit: 10485760,
    });
  }
}

export async function uploadPdf(
  userId: string,
  uri: string,
  fileName: string
): Promise<MedicalDocument> {
  await ensureBucketExists();

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const arrayBuffer = decode(base64);
  const storagePath = `${userId}/${Date.now()}_${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, arrayBuffer, {
      contentType: "application/pdf",
      cacheControl: "3600",
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const { data: doc, error: dbError } = await supabase
    .from("medical_documents")
    .insert({
      user_id: userId,
      name: fileName,
      storage_path: storagePath,
      page_count: null,
    })
    .select()
    .single();

  if (dbError) {
    throw new Error(`Failed to save document: ${dbError.message}`);
  }

  return doc as unknown as MedicalDocument;
}

export async function deleteDocument(documentId: string): Promise<void> {
  // First get the document to know the storage path
  const { data: doc, error: fetchError } = await supabase
    .from("medical_documents")
    .select("storage_path")
    .eq("id", documentId)
    .single();

  if (fetchError) throw new Error(`Document not found: ${fetchError.message}`);

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([doc.storage_path]);

  if (storageError) {
    console.error("Storage delete error:", storageError.message);
  }

  // Delete conversations related to this document
  const { error: convError } = await supabase
    .from("ai_conversations")
    .delete()
    .eq("session_id", documentId);

  if (convError) {
    console.error("Conversation delete error:", convError.message);
  }

  // Delete document record
  const { error: dbError } = await supabase
    .from("medical_documents")
    .delete()
    .eq("id", documentId);

  if (dbError) throw new Error(`Failed to delete document: ${dbError.message}`);
}

export async function getUserDocuments(
  userId: string
): Promise<MedicalDocument[]> {
  const { data, error } = await supabase
    .from("medical_documents")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch documents: ${error.message}`);
  return (data ?? []) as MedicalDocument[];
}

// ── OpenAI Q&A (RAG) ───────────────────────────────────

export async function askQuestion(
  document: MedicalDocument,
  question: string
): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }

  // Try to download and extract text from the PDF
  let pdfContext = `The user has a medical document called "${document.name}". `;

  try {
    const { data: pdfData, error: downloadError } = await supabase.storage
      .from(BUCKET_NAME)
      .download(document.storage_path);

    if (!downloadError && pdfData) {
      // Convert blob to text — PDFs often have readable text embedded
      const pdfText = await pdfData.text();
      // Extract readable text: look for content between parentheses (PDF text objects)
      const textMatches = pdfText.match(/\(([^)]*)\)/g);
      if (textMatches && textMatches.length > 0) {
        const extractedText = textMatches
          .map(m => m.slice(1, -1))
          .filter(t => t.length > 3)
          .join(" ");
        if (extractedText.length > 50) {
          pdfContext += `Here is the extracted content from the PDF:\n\n${extractedText.slice(0, 15000)}\n\n`;
        }
      }
    }
  } catch {
    // PDF text extraction failed — continue with just the filename
    pdfContext += `The full PDF content could not be extracted for analysis. Answer based on general medical knowledge related to the document title.`;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 4096,
      messages: [
        {
          role: "system",
          content: `You are a clinical AI assistant for GlucoScan, an app for diabetic users.
You analyze medical documents and answer questions about their content.
Be accurate, clear, and reference specific parts of the document if available.
If the answer isn't in the provided document content, say so clearly.
Use medical terminology appropriately but explain complex terms.`,
        },
        {
          role: "user",
          content: `${pdfContext}\n\nQuestion: ${question}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${text}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "No response from AI.";
}

// ── Conversation persistence ───────────────────────────

export async function saveMessage(
  userId: string,
  documentId: string,
  documentName: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  await supabase.from("ai_conversations").insert({
    user_id: userId,
    session_id: documentId,
    role,
    content,
    metadata: { document_id: documentId, document_name: documentName },
  });
}

export async function getConversationHistory(
  documentId: string
): Promise<ChatMessage[]> {
  const { data } = await supabase
    .from("ai_conversations")
    .select("*")
    .eq("session_id", documentId)
    .order("created_at", { ascending: true });

  return (data ?? []) as ChatMessage[];
}
