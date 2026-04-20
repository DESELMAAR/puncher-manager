import { redirect } from "next/navigation";

/** @deprecated Use /admin/employees */
export default function UsersAdminRedirect() {
  redirect("/admin/employees");
}
