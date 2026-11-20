import type { ReactNode } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { siteConfig } from "@/config/site";

type AuthShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <main className="flex flex-1 items-center justify-center bg-background px-4 py-10 sm:px-6">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          <Link href="/" className="font-heading text-2xl font-bold text-primary">
            {siteConfig.name}
          </Link>
        </div>

        <Card className="border-border bg-surface shadow-sm">
          <CardHeader className="gap-2">
            <CardTitle className="text-2xl text-primary">{title}</CardTitle>
            <CardDescription className="text-text-muted">{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>

        {footer ? <p className="text-center text-sm text-text-muted">{footer}</p> : null}
      </div>
    </main>
  );
}
