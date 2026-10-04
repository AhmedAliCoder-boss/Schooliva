export type ThemeMode = "light" | "dark" | "system";

export type BrandingThemeInput = {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  backgroundColor?: string | null;
  foregroundColor?: string | null;
  cardColor?: string | null;
  mutedColor?: string | null;
  borderColor?: string | null;
  successColor?: string | null;
  warningColor?: string | null;
  destructiveColor?: string | null;
  infoColor?: string | null;
  themeMode?: ThemeMode | null;
};

export type BrandingTheme = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  foregroundColor: string;
  cardColor: string;
  mutedColor: string;
  borderColor: string;
  successColor: string;
  warningColor: string;
  destructiveColor: string;
  infoColor: string;
  themeMode: ThemeMode;
};

function normalizeHexColor(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 4 && /^#?[0-9a-fA-F]{3}$/.test(trimmed)) {
    const hex = trimmed.replace("#", "");
    return `#${hex.split("").map((part) => part + part).join("")}`.toLowerCase();
  }

  if (trimmed.length === 7 && /^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  return trimmed.toLowerCase();
}

export function sanitizeColor(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const candidate = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  if (/^#[0-9a-fA-F]{3}$/.test(candidate) || /^#[0-9a-fA-F]{6}$/.test(candidate)) {
    return normalizeHexColor(candidate);
  }

  return null;
}

function clampColor(value: string | null | undefined, fallback: string) {
  return sanitizeColor(value) ?? fallback;
}

function relativeLuminance(hex: string) {
  const value = hex.replace("#", "");
  const parsed = value.length === 3
    ? value.split("").map((part) => part + part).join("")
    : value;

  const channel = Number.parseInt(parsed, 16);
  const r = (channel >> 16) & 255;
  const g = (channel >> 8) & 255;
  const b = channel & 255;

  const [red, green, blue] = [r, g, b].map((sample) => {
    const normalized = sample / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function isLightColor(value: string | null | undefined) {
  if (!value) return true;
  const sanitized = sanitizeColor(value);
  if (!sanitized) return true;
  return relativeLuminance(sanitized) > 0.55;
}

export function chooseReadableForeground(background: string | null | undefined) {
  return isLightColor(background) ? "#0f172a" : "#f8fafc";
}

export function buildBrandingTheme(input: BrandingThemeInput = {}): BrandingTheme {
  const themeMode = input.themeMode === "dark" || input.themeMode === "light" || input.themeMode === "system" ? input.themeMode : "light";
  const primaryColor = clampColor(input.primaryColor, "#1d4ed8");
  const secondaryColor = clampColor(input.secondaryColor, "#0f172a");
  const accentColor = clampColor(input.accentColor, "#f59e0b");
  const backgroundColor = clampColor(input.backgroundColor, "#f8fafc");
  const foregroundColor = clampColor(input.foregroundColor, chooseReadableForeground(primaryColor));
  const cardColor = clampColor(input.cardColor, "#ffffff");
  const mutedColor = clampColor(input.mutedColor, "#64748b");
  const borderColor = clampColor(input.borderColor, "#dfe7ee");
  const successColor = clampColor(input.successColor, "#16a34a");
  const warningColor = clampColor(input.warningColor, "#f59e0b");
  const destructiveColor = clampColor(input.destructiveColor, "#dc2626");
  const infoColor = clampColor(input.infoColor, "#2563eb");

  return {
    primaryColor,
    secondaryColor,
    accentColor,
    backgroundColor,
    foregroundColor,
    cardColor,
    mutedColor,
    borderColor,
    successColor,
    warningColor,
    destructiveColor,
    infoColor,
    themeMode,
  };
}

export function buildBrandingCssVars(theme: BrandingTheme) {
  return {
    "--brand-primary": theme.primaryColor,
    "--brand-secondary": theme.secondaryColor,
    "--brand-accent": theme.accentColor,
    "--brand-background": theme.backgroundColor,
    "--brand-foreground": theme.foregroundColor,
    "--brand-card": theme.cardColor,
    "--brand-muted": theme.mutedColor,
    "--brand-border": theme.borderColor,
    "--brand-success": theme.successColor,
    "--brand-warning": theme.warningColor,
    "--brand-danger": theme.destructiveColor,
    "--brand-info": theme.infoColor,
    "--brand-theme-mode": theme.themeMode,
    "--brand-blue": theme.primaryColor,
    "--brand-navy": theme.secondaryColor,
    "--brand-cyan": theme.accentColor,
    "--brand-green": theme.successColor,
    "--moss": theme.primaryColor,
    "--warm": theme.accentColor,
    "--lime": theme.accentColor,
    "--background": theme.backgroundColor,
    "--foreground": theme.foregroundColor,
    "--surface": theme.cardColor,
    "--surface-soft": theme.backgroundColor,
    "--ink-soft": theme.mutedColor,
    "--line": theme.borderColor,
    "--success": theme.successColor,
    "--warning": theme.warningColor,
    "--danger": theme.destructiveColor,
    "--info": theme.infoColor,
  } as Record<string, string>;
}

export async function getSchoolBrandingForSchool(supabase: any, schoolId: string) {
  const { data: branding } = await supabase.from("school_branding").select("id,school_id,logo_path,logo_dark_path,favicon_path,primary_color,secondary_color,accent_color,background_color,foreground_color,card_color,muted_color,border_color,success_color,warning_color,destructive_color,info_color,theme_mode").eq("school_id", schoolId).maybeSingle();

  if (!branding) {
    return null;
  }

  const theme = buildBrandingTheme({
    primaryColor: branding.primary_color,
    secondaryColor: branding.secondary_color,
    accentColor: branding.accent_color,
    backgroundColor: branding.background_color,
    foregroundColor: branding.foreground_color,
    cardColor: branding.card_color,
    mutedColor: branding.muted_color,
    borderColor: branding.border_color,
    successColor: branding.success_color,
    warningColor: branding.warning_color,
    destructiveColor: branding.destructive_color,
    infoColor: branding.info_color,
    themeMode: branding.theme_mode,
  });

  const getSignedAsset = async (path: string | null) => {
    if (!path) return null;
    const { data, error } = await supabase.storage.from("school-branding").createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  };

  const [logoUrl, logoDarkUrl, faviconUrl] = await Promise.all([
    getSignedAsset(branding.logo_path),
    getSignedAsset(branding.logo_dark_path),
    getSignedAsset(branding.favicon_path),
  ]);

  return {
    ...branding,
    theme,
    logoUrl,
    logoDarkUrl,
    faviconUrl,
  };
}
