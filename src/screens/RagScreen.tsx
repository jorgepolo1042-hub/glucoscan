import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { supabase } from "../lib/supabase";
import {
  uploadPdf,
  askQuestion,
  getConversationHistory,
  saveMessage,
  getUserDocuments,
  deleteDocument,
  type MedicalDocument,
  type ChatMessage,
} from "../services/ragService";
import { theme } from "../config/theme";
import { ScreenHeader } from "../components/ui/ScreenHeader";

interface RagScreenProps {
  onClose: () => void;
  userId: string | null;
}

export function RagScreen({ onClose, userId }: RagScreenProps) {
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<MedicalDocument | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showDocs, setShowDocs] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const loadDocuments = useCallback(async () => {
    if (!userId) return;
    try {
      const docs = await getUserDocuments(userId);
      setDocuments(docs);
    } catch (error) { console.error("Failed to load documents:", error); }
  }, [userId]);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  const handlePickPdf = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      if (!userId) return;
      setIsUploading(true);
      const doc = await uploadPdf(userId, file.uri, file.name);
      setDocuments((prev) => [doc, ...prev]);
      setSelectedDoc(doc);
      setShowDocs(false);
      setMessages([]);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Upload failed";
      Alert.alert("Error", msg);
    } finally { setIsUploading(false); }
  }, [userId]);

  const handleSelectDocument = useCallback(async (doc: MedicalDocument) => {
    setSelectedDoc(doc);
    setShowDocs(false);
    setIsLoading(true);
    try {
      const history = await getConversationHistory(doc.id);
      setMessages(history);
    } catch { setMessages([]); }
    finally { setIsLoading(false); }
  }, []);

  const handleSend = useCallback(async () => {
    const question = inputText.trim();
    if (!question || !selectedDoc || !userId) return;
    setInputText("");
    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: question, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    try {
      await saveMessage(userId, selectedDoc.id, selectedDoc.name, "user", question);
      const answer = await askQuestion(selectedDoc, question);
      const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: "assistant", content: answer, created_at: new Date().toISOString() };
      setMessages((prev) => [...prev, aiMsg]);
      await saveMessage(userId, selectedDoc.id, selectedDoc.name, "assistant", answer);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to answer";
      Alert.alert("Error", msg);
    } finally { setIsLoading(false); }
  }, [inputText, selectedDoc, userId, messages]);

  const handleDeleteDocument = useCallback(async (doc: MedicalDocument) => {
    Alert.alert("Delete Document", `Are you sure you want to delete "${doc.name}"?\n\nThis will also remove all chat conversations for this document.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        setIsDeleting(doc.id);
        try {
          await deleteDocument(doc.id);
          setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
          if (selectedDoc?.id === doc.id) { setSelectedDoc(null); setShowDocs(true); setMessages([]); }
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Failed to delete";
          Alert.alert("Error", msg);
        } finally { setIsDeleting(null); }
      }},
    ]);
  }, [selectedDoc?.id]);

  useEffect(() => { setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100); }, [messages]);

  if (showDocs) {
    return (
      <View style={styles.container}>
      <ScreenHeader title="Clinical Assistant" icon="🤖" onClose={onClose} />

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <Pressable style={({ pressed }) => [styles.uploadButton, pressed && !isUploading && { opacity: 0.8 }]} onPress={handlePickPdf} disabled={isUploading}>
            {isUploading ? <ActivityIndicator color={theme.colors.textInverse} /> : (
              <>
                <Text style={styles.uploadIcon}>📄</Text>
                <Text style={styles.uploadText}>Upload Medical PDF</Text>
                <Text style={styles.uploadSub}>Lab results, prescriptions, clinical notes</Text>
              </>
            )}
          </Pressable>

          {documents.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Your Documents ({documents.length})</Text>
              {documents.map((doc) => (
                <View key={doc.id} style={styles.docCardWrapper}>
                  <Pressable style={({ pressed }) => [styles.docCard, pressed && { opacity: 0.7 }]} onPress={() => handleSelectDocument(doc)}>
                    <Text style={styles.docIcon}>📄</Text>
                    <View style={styles.docInfo}>
                      <Text style={styles.docName} numberOfLines={1}>{doc.name}</Text>
                      <Text style={styles.docDate}>{new Date(doc.created_at).toLocaleDateString()}</Text>
                    </View>
                    <Text style={styles.docArrow}>→</Text>
                  </Pressable>
                  <Pressable style={({ pressed }) => [styles.docDeleteButton, pressed && { opacity: 0.7 }]} onPress={() => handleDeleteDocument(doc)} disabled={isDeleting === doc.id}>
                    {isDeleting === doc.id ? <ActivityIndicator size="small" color={theme.colors.danger} /> : <Text style={styles.docDeleteText}>🗑</Text>}
                  </Pressable>
                </View>
              ))}
            </>
          )}

          {documents.length === 0 && !isUploading && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🩺</Text>
              <Text style={styles.emptyTitle}>No documents yet</Text>
              <Text style={styles.emptySub}>Upload a medical PDF to start asking questions</Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <ScreenHeader
        title={selectedDoc?.name ?? "Chat"}
        onBack={() => { setSelectedDoc(null); setShowDocs(true); }}
        rightAction={selectedDoc ? (
          <Pressable style={({ pressed }) => [styles.deleteButtonSmall, pressed && { opacity: 0.7 }]} onPress={() => handleDeleteDocument(selectedDoc)} disabled={isDeleting === selectedDoc.id}>
            {isDeleting === selectedDoc.id ? <ActivityIndicator size="small" color={theme.colors.danger} /> : <Text style={styles.deleteButtonSmallText}>🗑</Text>}
          </Pressable>
        ) : undefined}
      />

      <ScrollView ref={scrollRef} style={styles.messagesContainer} contentContainerStyle={styles.messagesContent}>
        {messages.length === 0 && (
          <View style={styles.chatWelcome}>
            <Text style={styles.chatWelcomeIcon}>🤖</Text>
            <Text style={styles.chatWelcomeTitle}>Ask about your document</Text>
            <Text style={styles.chatWelcomeSub}>I've analyzed your PDF. Ask me anything about its medical content.</Text>
          </View>
        )}

        {messages.map((msg) => (
          <View key={msg.id} style={[styles.messageBubble, msg.role === "user" ? styles.userBubble : styles.aiBubble]}>
            <Text style={styles.messageRole}>{msg.role === "user" ? "You" : "AI"}</Text>
            <Text style={styles.messageText}>{msg.content}</Text>
          </View>
        ))}

        {isLoading && (
          <View style={[styles.messageBubble, styles.aiBubble]}>
            <Text style={styles.messageRole}>AI</Text>
            <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 8 }} />
          </View>
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Ask about your medical document..."
          placeholderTextColor={theme.colors.textTertiary}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={2000}
        />
        <Pressable
          style={({ pressed }) => [styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled, pressed && inputText.trim() && !isLoading && { opacity: 0.8 }]}
          onPress={handleSend}
          disabled={!inputText.trim() || isLoading}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  // Header provided by ScreenHeader component
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  uploadButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.xl, padding: 24, alignItems: "center",
    marginBottom: 24, ...theme.shadow.md,
  },
  uploadIcon: { fontSize: 36, marginBottom: 8 },
  uploadText: { color: theme.colors.textInverse, fontSize: 18, fontWeight: "700" },
  uploadSub: { color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 4 },

  sectionTitle: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: "700", marginBottom: 12 },
  docIcon: { fontSize: 24, marginRight: 12 },
  docInfo: { flex: 1 },
  docName: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: "600" },
  docDate: { color: theme.colors.textTertiary, fontSize: 12, marginTop: 2 },
  docCardWrapper: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 },
  docCard: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 14, ...theme.shadow.sm },
  docDeleteButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.surfaceSecondary, justifyContent: "center", alignItems: "center" },
  docDeleteText: { fontSize: 16 },
  docArrow: { color: theme.colors.textTertiary, fontSize: 18 },

  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: "700" },
  emptySub: { color: theme.colors.textTertiary, fontSize: 14, marginTop: 4, textAlign: "center" },

  deleteButtonSmall: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.surfaceSecondary, justifyContent: "center", alignItems: "center" },
  deleteButtonSmallText: { fontSize: 16 },

  // Chat
  messagesContainer: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 8 },
  chatWelcome: { alignItems: "center", paddingVertical: 40 },
  chatWelcomeIcon: { fontSize: 48, marginBottom: 12 },
  chatWelcomeTitle: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: "700" },
  chatWelcomeSub: { color: theme.colors.textTertiary, fontSize: 14, marginTop: 4, textAlign: "center", paddingHorizontal: 20 },

  messageBubble: { borderRadius: theme.radius.lg, padding: 14, marginBottom: 12, maxWidth: "85%" },
  userBubble: { backgroundColor: theme.colors.primary, alignSelf: "flex-end" },
  aiBubble: { backgroundColor: theme.colors.surface, alignSelf: "flex-start", ...theme.shadow.sm },
  messageRole: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "600", textTransform: "uppercase", marginBottom: 4 },
  messageText: { color: theme.colors.textPrimary, fontSize: 15, lineHeight: 22 },

  inputContainer: {
    flexDirection: "row", padding: 12, paddingBottom: 32,
    borderTopWidth: 1, borderTopColor: theme.colors.border, gap: 8,
  },
  textInput: {
    flex: 1, backgroundColor: theme.colors.surface, color: theme.colors.textPrimary,
    borderRadius: theme.radius.md, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 15, maxHeight: 100, borderWidth: 1, borderColor: theme.colors.border,
  },
  sendButton: {
    backgroundColor: theme.colors.primary, borderRadius: theme.radius.md,
    paddingHorizontal: 20, justifyContent: "center", alignItems: "center",
  },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { color: theme.colors.textInverse, fontSize: 15, fontWeight: "700" },
});
