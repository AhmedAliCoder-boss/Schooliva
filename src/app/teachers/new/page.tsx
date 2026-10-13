import { redirect } from "next/navigation";

export default function NewTeacherPage() {
  redirect("/hrm/employees?type=teacher");
}