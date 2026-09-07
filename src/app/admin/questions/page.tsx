"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  Eye,
  Code2,
  Bug,
} from "lucide-react";

interface TestCase {
  id?: string;
  question_id?: string;
  is_sample: boolean;
  stdin: string;
  expected_stdout: string;
  description: string;
  sort_order: number;
}

interface Question {
  id: string;
  exam_number: number;
  title: string;
  description: string;
  starter_code: string | null;
  solution_code: string | null;
  language: string;
  difficulty: string;
  question_type: "TDD" | "DEBUGGING";
  sort_order: number;
  is_active: boolean;
  test_cases?: TestCase[];
}

const defaultQuestion: Partial<Question> = {
  exam_number: 1,
  title: "",
  description: "",
  starter_code: "",
  solution_code: "",
  language: "python",
  difficulty: "medium",
  question_type: "TDD",
  sort_order: 0,
  is_active: true,
};

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<Question>>(defaultQuestion);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    fetchQuestions();
  }, []);

  async function fetchQuestions() {
    const { data } = await supabase
      .from("questions")
      .select("*")
      .order("exam_number")
      .order("sort_order");

    setQuestions(data || []);
    setLoading(false);
  }

  async function fetchTestCases(questionId: string) {
    const { data } = await supabase
      .from("test_cases")
      .select("*")
      .eq("question_id", questionId)
      .order("sort_order");

    return data || [];
  }

  const handleAdd = () => {
    setFormData({ ...defaultQuestion });
    setTestCases([]);
    setEditingId(null);
    setShowForm(true);
  };

  const handleEdit = async (q: Question) => {
    setFormData({ ...q });
    const tc = await fetchTestCases(q.id);
    setTestCases(tc);
    setEditingId(q.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const { test_cases, ...questionData } = formData as Question;

    let questionId = editingId;

    if (editingId) {
      const { error } = await supabase
        .from("questions")
        .update(questionData)
        .eq("id", editingId);
      if (error) {
        setSaving(false);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("questions")
        .insert(questionData)
        .select("id")
        .single();
      if (error || !data) {
        setSaving(false);
        return;
      }
      questionId = data.id;
    }

    // Save test cases
    if (questionId) {
      for (const tc of testCases) {
        if (tc.id) {
          await supabase
            .from("test_cases")
            .update({
              is_sample: tc.is_sample,
              stdin: tc.stdin,
              expected_stdout: tc.expected_stdout,
              description: tc.description,
              sort_order: tc.sort_order,
            })
            .eq("id", tc.id);
        } else {
          await supabase.from("test_cases").insert({
            question_id: questionId,
            is_sample: tc.is_sample,
            stdin: tc.stdin,
            expected_stdout: tc.expected_stdout,
            description: tc.description,
            sort_order: tc.sort_order,
          });
        }
      }
    }

    setShowForm(false);
    setEditingId(null);
    fetchQuestions();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this question and all its test cases?")) return;
    await supabase.from("test_cases").delete().eq("question_id", id);
    await supabase.from("questions").delete().eq("id", id);
    fetchQuestions();
  };

  const addTestCase = (isSample: boolean) => {
    setTestCases([
      ...testCases,
      {
        is_sample: isSample,
        stdin: "",
        expected_stdout: "",
        description: "",
        sort_order: testCases.length,
      },
    ]);
  };

  const updateTestCase = (
    index: number,
    field: keyof TestCase,
    value: string | boolean | number
  ) => {
    const updated = [...testCases];
    updated[index] = { ...updated[index], [field]: value };
    setTestCases(updated);
  };

  const removeTestCase = (index: number) => {
    setTestCases(testCases.filter((_, i) => i !== index));
  };

  const questionsByExam = {
    1: questions.filter((q) => q.exam_number === 1),
    2: questions.filter((q) => q.exam_number === 2),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary-light animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Question Bank</h1>
          <p className="text-gray-400 mt-1">
            {questions.length} questions across both rounds
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-light text-white rounded-lg font-medium transition-colors"
        >
          <Plus size={16} />
          Add Question
        </button>
      </div>

      {/* Questions list by exam */}
      {([1, 2] as const).map((examNum) => (
        <div key={examNum}>
          <div className="flex items-center gap-2 mb-3">
            {examNum === 1 ? (
              <Code2 className="w-5 h-5 text-primary-light" />
            ) : (
              <Bug className="w-5 h-5 text-accent" />
            )}
            <h2 className="text-lg font-bold text-foreground">
              Round {examNum}: {examNum === 1 ? "TDD" : "Debugging"} (
              {questionsByExam[examNum].length})
            </h2>
          </div>

          {questionsByExam[examNum].length === 0 ? (
            <div className="bg-surface border border-border rounded-xl p-6 text-center text-gray-500">
              No questions yet. Click &quot;Add Question&quot; to create one.
            </div>
          ) : (
            <div className="space-y-2">
              {questionsByExam[examNum].map((q) => (
                <div
                  key={q.id}
                  className="bg-surface border border-border rounded-xl overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() =>
                          setExpandedId(expandedId === q.id ? null : q.id)
                        }
                        className="text-gray-400 hover:text-foreground"
                      >
                        {expandedId === q.id ? (
                          <ChevronUp size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )}
                      </button>
                      <div>
                        <span className="font-medium text-foreground">
                          {q.title}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                          <span>{q.language}</span>
                          <span>•</span>
                          <span
                            className={
                              q.difficulty === "easy"
                                ? "text-success"
                                : q.difficulty === "hard"
                                ? "text-danger"
                                : "text-warning"
                            }
                          >
                            {q.difficulty}
                          </span>
                          <span>•</span>
                          <span className={q.question_type === "TDD" ? "text-primary-light" : "text-accent"}>
                            {q.question_type || "TDD"}
                          </span>
                          <span>•</span>
                          <span>Order: {q.sort_order}</span>
                          {!q.is_active && (
                            <>
                              <span>•</span>
                              <span className="text-danger">Inactive</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(q)}
                        className="p-1.5 text-gray-400 hover:text-foreground hover:bg-surface-light rounded transition-colors"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(q.id)}
                        className="p-1.5 text-gray-400 hover:text-danger hover:bg-danger/10 rounded transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {expandedId === q.id && (
                    <div className="px-4 pb-4 border-t border-border pt-3">
                      <div className="text-sm text-gray-400 mb-2">
                        Description preview:
                      </div>
                      <div className="bg-surface-light rounded-lg p-3 text-sm max-h-40 overflow-y-auto">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {q.description}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Question Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-surface border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <h3 className="text-lg font-bold text-foreground">
                {editingId ? "Edit Question" : "Add Question"}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-foreground hover:bg-surface-light rounded-lg transition-colors"
                >
                  <Eye size={14} />
                  {showPreview ? "Edit" : "Preview"}
                </button>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                  }}
                  className="p-1.5 text-gray-400 hover:text-foreground hover:bg-surface-light rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic info */}
              <div className="grid md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Exam Round
                  </label>
                  <select
                    value={formData.exam_number}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        exam_number: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2.5 bg-surface-light border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value={1}>Round 1: TDD</option>
                    <option value={2}>Round 2: Debugging</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Question Type
                  </label>
                  <select
                    value={formData.question_type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        question_type: e.target.value as "TDD" | "DEBUGGING",
                      })
                    }
                    className="w-full px-4 py-2.5 bg-surface-light border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="TDD">TDD (write from tests)</option>
                    <option value="DEBUGGING">DEBUGGING (fix bugs)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Language
                  </label>
                  <select
                    value={formData.language}
                    onChange={(e) =>
                      setFormData({ ...formData, language: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-surface-light border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="python">Python</option>
                    <option value="java">Java</option>
                    <option value="c">C</option>
                    <option value="cpp">C++</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Difficulty
                  </label>
                  <select
                    value={formData.difficulty}
                    onChange={(e) =>
                      setFormData({ ...formData, difficulty: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-surface-light border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-surface-light border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., Two Sum"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sort_order: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-4 py-2.5 bg-surface-light border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Description (Markdown) */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Problem Description (Markdown)
                </label>
                {showPreview ? (
                  <div className="w-full min-h-[200px] px-4 py-3 bg-surface-light border border-border rounded-lg">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {formData.description || ""}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={10}
                    className="w-full px-4 py-3 bg-surface-light border border-border rounded-lg text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                    placeholder="# Problem Title&#10;&#10;Write your problem description here using Markdown..."
                  />
                )}
              </div>

              {/* Starter / Buggy Code */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  {formData.question_type === "TDD"
                    ? "Starter Code"
                    : "Buggy Code (for students to fix)"}
                </label>
                <textarea
                  value={formData.starter_code || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, starter_code: e.target.value })
                  }
                  rows={10}
                  className="w-full px-4 py-3 bg-surface-light border border-border rounded-lg text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                  placeholder={
                    formData.question_type === "TDD"
                      ? "# Write your solution here"
                      : "# This code has bugs - find and fix them"
                  }
                />
              </div>

              {/* Reference Solution */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Reference Solution (Admin only, not visible to students)
                </label>
                <textarea
                  value={formData.solution_code || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, solution_code: e.target.value })
                  }
                  rows={8}
                  className="w-full px-4 py-3 bg-surface-light border border-border rounded-lg text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                  placeholder="# Correct solution for reference"
                />
              </div>

              {/* Test Cases */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-300">
                    Test Cases ({testCases.length})
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => addTestCase(true)}
                      className="flex items-center gap-1 px-3 py-1 bg-success/10 text-success rounded text-xs font-medium hover:bg-success/20 transition-colors"
                    >
                      <Plus size={12} />
                      Sample Test
                    </button>
                    <button
                      onClick={() => addTestCase(false)}
                      className="flex items-center gap-1 px-3 py-1 bg-warning/10 text-warning rounded text-xs font-medium hover:bg-warning/20 transition-colors"
                    >
                      <Plus size={12} />
                      Hidden Test
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {testCases.map((tc, i) => (
                    <div
                      key={i}
                      className={`p-4 rounded-lg border ${
                        tc.is_sample
                          ? "bg-success/5 border-success/20"
                          : "bg-warning/5 border-warning/20"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded ${
                            tc.is_sample
                              ? "bg-success/10 text-success"
                              : "bg-warning/10 text-warning"
                          }`}
                        >
                          {tc.is_sample ? "Sample" : "Hidden"} Test #{i + 1}
                        </span>
                        <button
                          onClick={() => removeTestCase(i)}
                          className="text-gray-400 hover:text-danger transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="grid md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">
                            Input (stdin)
                          </label>
                          <textarea
                            value={tc.stdin}
                            onChange={(e) =>
                              updateTestCase(i, "stdin", e.target.value)
                            }
                            rows={3}
                            className="w-full px-3 py-2 bg-surface border border-border rounded text-foreground font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                            placeholder="Standard input"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">
                            Expected Output (stdout)
                          </label>
                          <textarea
                            value={tc.expected_stdout}
                            onChange={(e) =>
                              updateTestCase(i, "expected_stdout", e.target.value)
                            }
                            rows={3}
                            className="w-full px-3 py-2 bg-surface border border-border rounded text-foreground font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                            placeholder="Expected output"
                          />
                        </div>
                      </div>
                      <div className="mt-2">
                        <input
                          type="text"
                          value={tc.description || ""}
                          onChange={(e) =>
                            updateTestCase(i, "description", e.target.value)
                          }
                          className="w-full px-3 py-1.5 bg-surface border border-border rounded text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="Optional description/hint"
                        />
                      </div>
                    </div>
                  ))}

                  {testCases.length === 0 && (
                    <div className="text-center text-gray-500 text-sm py-6">
                      No test cases added yet. Add sample tests for students to
                      verify, and hidden tests for grading.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Save footer */}
            <div className="sticky bottom-0 bg-surface border-t border-border px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="px-4 py-2 bg-surface-light border border-border rounded-lg text-foreground hover:bg-border transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.title}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-light disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                {editingId ? "Update" : "Create"} Question
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
