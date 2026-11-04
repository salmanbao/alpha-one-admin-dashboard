"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@pfaas/ui/cn"

/**
 * Focus-restore channel (audit finding #7 — keyboard navigation).
 *
 * Radix's modal DialogContent always `preventDefault()`s FocusScope's
 * default focus restore and focuses `triggerRef.current` instead — for
 * trigger-less controlled `<Dialog open …>` wrappers that ref is null,
 * so keyboard focus dropped to <body> after Esc/close instead of
 * returning to the control that opened the dialog. DialogRoot records
 * the element focused just before the dialog takes focus; DialogContent
 * restores it on close. Radix's own trigger focus still runs afterwards
 * when a trigger exists, so trigger-based dialogs behave as before.
 */
type OpenerRef = React.RefObject<HTMLElement | null>

const DialogOpenerContext = React.createContext<OpenerRef | null>(null)

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  const openerRef = React.useRef<HTMLElement | null>(null)
  return (
    <DialogOpenerContext.Provider value={openerRef}>
      <DialogPrimitive.Root data-slot="dialog" {...props} />
    </DialogOpenerContext.Provider>
  )
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  const openerRef = React.useContext(DialogOpenerContext)
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
          className
        )}
        {...props}
        onOpenAutoFocus={(event) => {
          onOpenAutoFocus?.(event)
          // Runs before FocusScope moves focus into the dialog, so
          // activeElement is still the opener (works for dialogs mounted
          // fresh with open=true, where there is no open transition).
          if (openerRef) {
            openerRef.current =
              typeof document !== "undefined" &&
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null
          }
        }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event)
          // A caller that preventDefault()'d owns restore — leave it.
          if (event.defaultPrevented) return
          const opener = openerRef?.current ?? null
          if (openerRef) openerRef.current = null
          if (opener && opener.isConnected && opener !== document.body) {
            opener.focus()
          }
        }}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}

/* Shared with alert-dialog.tsx so AlertDialogs use the same opener
 * capture/restore channel. Not part of the public component surface. */
export { DialogOpenerContext }
