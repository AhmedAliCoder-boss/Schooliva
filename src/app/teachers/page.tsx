import { redirect } from "next/navigation";

export default function TeachersPage() {
  redirect("/hrm/employees?type=teacher");
}
