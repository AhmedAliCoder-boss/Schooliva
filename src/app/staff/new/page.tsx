import { redirect } from "next/navigation";

export default function NewStaffPage() {
  redirect("/hrm/employees?type=staff");
}