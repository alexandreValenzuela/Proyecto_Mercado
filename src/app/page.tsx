import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { siteConfig } from "@/config/site";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
      <Card className="w-full max-w-xl border-border bg-surface shadow-sm">
        <CardHeader className="gap-3">
          <Badge variant="secondary" className="w-fit">
            Fase 0
          </Badge>
          <CardTitle className="font-heading text-3xl text-primary">
            {siteConfig.name}
          </CardTitle>
          <CardDescription className="text-text-muted">
            La base del proyecto ya está lista.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed text-text-muted">
          <p>Tienda en construcción: acá vas a encontrar el catálogo muy pronto.</p>
          <p>
            Mientras tanto, seguimos armando la estructura de datos, la autenticación y el
            panel de administración.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
