"use client";
/** * PFaaS Platform — Root Providers * * Mounts the platform context and toaster. Shows boot screen while * platform initializes. */import { useState, useEffect } from "react";import { PlatformProvider } from "@/lib/platform/platform-context";import { bootstrapModules } from "@/lib/platform/module-bootstrap";import { Toaster } from "@/components/ui/toaster";import { BootScreen } from "@/components/shell/boot-screen";
bootstrapModules();
export function Providers({ children }: { children: React.ReactNode }) {  const [booted, setBooted] = useState(false);
  useEffect(() => {    if (typeof window === "undefined") return;    try {      if (window.sessionStorage.getItem("pfaas:booted") === "1") {        setBooted(true);      }    } catch { /* ignore */ }  }, []);
  if (!booted) {    return (      <BootScreen        onDone={() => {          setBooted(true);          if (typeof window !== "undefined") {            try { window.sessionStorage.setItem("pfaas:booted", "1"); } catch { /* ignore */ }          }        }}      />    );  }
  return (    <PlatformProvider>      {children}      <Toaster />    </PlatformProvider>  );}