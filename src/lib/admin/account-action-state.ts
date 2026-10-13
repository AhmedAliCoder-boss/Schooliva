export type AccountActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialAccountActionState: AccountActionState = { status: "idle", message: "" };
