import { redirect } from "next/navigation";

export default function StaffPage() {
  redirect("/hrm/employees?type=staff");
}
