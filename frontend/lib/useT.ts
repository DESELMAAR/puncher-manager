import { useI18nStore } from "@/store/i18nStore";
import { t, type I18nKey } from "@/lib/i18n";

export function useT() {
  const lang = useI18nStore((s) => s.lang);
  return (key: I18nKey) => t(lang, key);
}

