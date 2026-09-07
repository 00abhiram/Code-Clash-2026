export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          roll_no: string;
          branch: string;
          year: string;
          email: string;
          role: "student" | "admin";
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          roll_no: string;
          branch: string;
          year?: string;
          email: string;
          role?: "student" | "admin";
          is_active?: boolean;
        };
        Update: {
          full_name?: string;
          roll_no?: string;
          branch?: string;
          year?: string;
          email?: string;
          role?: "student" | "admin";
          is_active?: boolean;
        };
      };
      settings: {
        Row: {
          id: number;
          is_anti_cheat_enabled: boolean;
          exam1_unlock_at: string;
          exam2_unlock_at: string;
          exam1_duration_minutes: number;
          exam2_duration_minutes: number;
          exam1_pool_questions: boolean;
          exam2_pool_questions: boolean;
          updated_at: string;
        };
        Update: {
          is_anti_cheat_enabled?: boolean;
          exam1_unlock_at?: string;
          exam2_unlock_at?: string;
          exam1_duration_minutes?: number;
          exam2_duration_minutes?: number;
          exam1_pool_questions?: boolean;
          exam2_pool_questions?: boolean;
        };
      };
      questions: {
        Row: {
          id: string;
          exam_number: number;
          question_type: "TDD" | "DEBUGGING";
          title: string;
          description: string;
          starter_code: string | null;
          solution_code: string | null;
          language: string;
          difficulty: "easy" | "medium" | "hard";
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          exam_number: number;
          question_type?: "TDD" | "DEBUGGING";
          title: string;
          description: string;
          starter_code?: string | null;
          solution_code?: string | null;
          language?: string;
          difficulty?: "easy" | "medium" | "hard";
          sort_order?: number;
          is_active?: boolean;
        };
        Update: {
          exam_number?: number;
          question_type?: "TDD" | "DEBUGGING";
          title?: string;
          description?: string;
          starter_code?: string | null;
          solution_code?: string | null;
          language?: string;
          difficulty?: "easy" | "medium" | "hard";
          sort_order?: number;
          is_active?: boolean;
        };
      };
      test_cases: {
        Row: {
          id: string;
          question_id: string;
          is_sample: boolean;
          stdin: string;
          expected_stdout: string;
          description: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          question_id: string;
          is_sample?: boolean;
          stdin?: string;
          expected_stdout: string;
          description?: string | null;
          sort_order?: number;
        };
        Update: {
          is_sample?: boolean;
          stdin?: string;
          expected_stdout?: string;
          description?: string | null;
          sort_order?: number;
        };
      };
      exam_sessions: {
        Row: {
          id: string;
          user_id: string;
          exam_number: number;
          status: "pending" | "in_progress" | "completed";
          started_at: string;
          submitted_at: string | null;
          is_submitted: boolean;
          is_locked: boolean;
          violation_count: number;
          fullscreen_exit_count: number;
          duration_minutes: number | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          exam_number: number;
          status?: "pending" | "in_progress" | "completed";
          started_at?: string;
          submitted_at?: string | null;
          is_submitted?: boolean;
          is_locked?: boolean;
          violation_count?: number;
          fullscreen_exit_count?: number;
          duration_minutes?: number | null;
          ip_address?: string | null;
          user_agent?: string | null;
        };
        Update: {
          status?: "pending" | "in_progress" | "completed";
          submitted_at?: string | null;
          is_submitted?: boolean;
          is_locked?: boolean;
          violation_count?: number;
          fullscreen_exit_count?: number;
          duration_minutes?: number | null;
        };
      };
      submissions: {
        Row: {
          id: string;
          user_id: string;
          question_id: string;
          exam_session_id: string;
          code: string;
          language: string;
          sample_tests_passed: number;
          sample_tests_total: number;
          hidden_tests_passed: number;
          hidden_tests_total: number;
          execution_time_ms: number | null;
          status: "pending" | "passed" | "failed" | "error";
          submitted_at: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          question_id: string;
          exam_session_id: string;
          code: string;
          language: string;
          sample_tests_passed?: number;
          sample_tests_total?: number;
          hidden_tests_passed?: number;
          hidden_tests_total?: number;
          execution_time_ms?: number | null;
          status?: "pending" | "passed" | "failed" | "error";
        };
        Update: {
          sample_tests_passed?: number;
          sample_tests_total?: number;
          hidden_tests_passed?: number;
          hidden_tests_total?: number;
          execution_time_ms?: number | null;
          status?: "pending" | "passed" | "failed" | "error";
          submitted_at?: string;
        };
      };
      violations: {
        Row: {
          id: string;
          user_id: string;
          exam_session_id: string;
          violation_type: "tab_switch" | "fullscreen_exit" | "shortcut_attempt" | "other";
          description: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          exam_session_id: string;
          violation_type: "tab_switch" | "fullscreen_exit" | "shortcut_attempt" | "other";
          description?: string | null;
        };
      };
      student_assignments: {
        Row: {
          id: string;
          user_id: string;
          question_id: string;
          exam_number: number;
          assigned_at: string;
        };
        Insert: {
          user_id: string;
          question_id: string;
          exam_number: number;
        };
      };
      question_solutions: {
        Row: {
          question_id: string;
          solution_code: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          question_id: string;
          solution_code: string;
        };
        Update: {
          solution_code?: string;
        };
      };
    };
  };
};

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Question = Database["public"]["Tables"]["questions"]["Row"];
export type TestCase = Database["public"]["Tables"]["test_cases"]["Row"];
export type ExamSession = Database["public"]["Tables"]["exam_sessions"]["Row"];
export type Submission = Database["public"]["Tables"]["submissions"]["Row"];
export type Violation = Database["public"]["Tables"]["violations"]["Row"];
export type Settings = Database["public"]["Tables"]["settings"]["Row"];

export interface PistonExecutionResult {
  language: string;
  version: string;
  run: {
    stdout: string;
    stderr: string;
    output: string;
    code: number | null;
    signal: string | null;
    message: string | null;
    status: string | null;
    cpu_time: number | null;
    wall_time: number | null;
    memory: number | null;
  };
  compile?: {
    stdout: string;
    stderr: string;
    output: string;
    code: number | null;
    signal: string | null;
    message: string | null;
    status: string | null;
    cpu_time: number | null;
    wall_time: number | null;
    memory: number | null;
  };
}

export interface ExecuteCodeRequest {
  language: string;
  code: string;
  stdin?: string;
}

export interface TestCaseResult {
  passed: boolean;
  stdin: string;
  expected: string;
  actual: string;
  error?: string;
}
