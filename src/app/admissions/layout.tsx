import { AdmissionsNavigation } from "@/components/admissions/admissions-navigation";

export default function AdmissionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdmissionsNavigation />
      {children}
    </>
  );
}
