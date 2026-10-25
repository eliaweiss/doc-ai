"use client";
import { NextIntlClientProvider } from "next-intl";
import { createContext, useContext, useState, useEffect } from "react";
import { useAppStore } from "./appStore";

const LocaleContext = createContext<any>(null);

export function LocaleProvider({
  children,
  defaultLocale,
}: {
  children: React.ReactNode;
  defaultLocale: string;
}) {
  const [lang, setLang] = useState("en_US");
  const [locale, setLocale] = useState(defaultLocale || "en");
  const [messages, setMessages] = useState({});
  const { setLocale: setAppLocale } = useAppStore();

  // Load initial messages
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const initialMessages = await import(
          `./messages/${defaultLocale || "en"}.json`
        );
        setMessages(initialMessages.default);
      } catch (error) {
        console.error(`Failed to load messages for ${defaultLocale}:`, error);
      }
    };

    loadMessages();
  }, [defaultLocale]);

  // Change locale dynamically
  const changeLocale = async (newLocale: string) => {
    setLocale(newLocale);
    try {
      const newMessages = await import(`./messages/${newLocale}.json`);
      setMessages(newMessages.default);
    } catch (error) {
      console.error(`Failed to load messages for ${newLocale}:`, error);
    }
  };

  useEffect(() => {
    // console.log("LocaleProvider locale", locale);
    setAppLocale(locale);
  }, [locale]);

  return (
    <LocaleContext.Provider value={{ locale, changeLocale, lang, setLang }}>
      {/* Only render children when messages are loaded */}
      {Object.keys(messages).length > 0 && (
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      )}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return context;
}
