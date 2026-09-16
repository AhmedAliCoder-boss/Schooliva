import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const fixture = {
  schoolA: process.env.TEST_SCHOOL_A_ID,
  schoolB: process.env.TEST_SCHOOL_B_ID,
  parentStudentA: process.env.TEST_PARENT_STUDENT_A_ID,
  parentStudentB: process.env.TEST_PARENT_STUDENT_B_ID,
  studentOther: process.env.TEST_OTHER_STUDENT_ID,
  unauthorizedClass: process.env.TEST_UNAUTHORIZED_CLASS_ID,
};
const users = {
  parent: [process.env.TEST_PARENT_EMAIL, process.env.TEST_PARENT_PASSWORD],
  student: [process.env.TEST_STUDENT_EMAIL, process.env.TEST_STUDENT_PASSWORD],
  teacher: [process.env.TEST_TEACHER_EMAIL, process.env.TEST_TEACHER_PASSWORD],
  accountant: [process.env.TEST_ACCOUNTANT_EMAIL, process.env.TEST_ACCOUNTANT_PASSWORD],
} as const;
const ready = Boolean(url && anonKey && fixture.schoolA && fixture.schoolB && Object.values(users).every(([email, password]) => email && password));

describe("Supabase RLS integration", () => {
  let clients: Record<keyof typeof users, SupabaseClient>;

  async function signedIn(email: string, password: string) {
    const client = createClient(url!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return client;
  }

  beforeAll(async () => {
    if (!ready) {
      throw new Error("RLS integration fixtures are missing. Configure tests/.env.test from tests/.env.test.example.");
    }
    clients = {
      parent: await signedIn(users.parent[0]!, users.parent[1]!),
      student: await signedIn(users.student[0]!, users.student[1]!),
      teacher: await signedIn(users.teacher[0]!, users.teacher[1]!),
      accountant: await signedIn(users.accountant[0]!, users.accountant[1]!),
    };
  });

  it("keeps a school member out of another school", async () => {
    const { data, error } = await clients.student.from("students").select("id").eq("school_id", fixture.schoolB!);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("limits a parent to linked children", async () => {
    const { data, error } = await clients.parent.from("students").select("id").in("id", [fixture.parentStudentA!, fixture.parentStudentB!]);
    expect(error).toBeNull();
    expect(data?.map((row) => row.id)).toContain(fixture.parentStudentA);
    expect(data?.map((row) => row.id)).not.toContain(fixture.parentStudentB);
  });

  it("limits a student to their own record and results", async () => {
    const students = await clients.student.from("students").select("id").in("id", [fixture.parentStudentA!, fixture.studentOther!]);
    const marks = await clients.student.from("marks").select("student_id").in("student_id", [fixture.parentStudentA!, fixture.studentOther!]);
    expect(students.error).toBeNull();
    expect(marks.error).toBeNull();
    expect(students.data?.map((row) => row.id)).not.toContain(fixture.parentStudentA);
    expect(marks.data?.map((row) => row.student_id)).not.toContain(fixture.parentStudentA);
  });

  it("does not let a teacher read an unauthorized class timetable", async () => {
    const { data, error } = await clients.teacher.from("timetable_entries").select("id,class_id").eq("school_id", fixture.schoolA!).eq("class_id", fixture.unauthorizedClass!);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("does not give an accountant academic reads while preserving finance access", async () => {
    const [classes, exams, fees] = await Promise.all([
      clients.accountant.from("classes").select("id").eq("school_id", fixture.schoolA!),
      clients.accountant.from("exams").select("id").eq("school_id", fixture.schoolA!),
      clients.accountant.from("fee_invoices").select("id").eq("school_id", fixture.schoolA!),
    ]);
    expect(classes.error).toBeNull();
    expect(exams.error).toBeNull();
    expect(fees.error).toBeNull();
    expect(classes.data).toEqual([]);
    expect(exams.data).toEqual([]);
  });
});
