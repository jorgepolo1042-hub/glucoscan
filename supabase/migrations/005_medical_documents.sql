-- ============================================================
-- GlucoScan — Migration 005: Medical Documents for RAG
-- ============================================================

CREATE TABLE IF NOT EXISTS medical_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  page_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medical_documents_user ON medical_documents(user_id, created_at DESC);

ALTER TABLE medical_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own documents" ON medical_documents;
CREATE POLICY "Users can view own documents"
  ON medical_documents FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own documents" ON medical_documents;
CREATE POLICY "Users can insert own documents"
  ON medical_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own documents" ON medical_documents;
CREATE POLICY "Users can delete own documents"
  ON medical_documents FOR DELETE
  USING (auth.uid() = user_id);
