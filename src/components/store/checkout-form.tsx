"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CreditCard, MapPin, PackageCheck, Truck } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm, useWatch, type FieldErrors } from "react-hook-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CartSummary } from "@/lib/cart/types";
import type { AddressView, CheckoutSettingsView } from "@/lib/checkout/view-types";
import { formatMoney } from "@/lib/money";
import { ARGENTINE_PROVINCES } from "@/lib/provinces";
import { checkoutFormSchema, type CheckoutFormValues } from "@/lib/validators/checkout";
import { createCheckout } from "@/server/checkout/actions";

type Props = {
  addresses: AddressView[];
  settings: CheckoutSettingsView;
  cart: CartSummary;
};

function collectValidationMessages(errors: FieldErrors<CheckoutFormValues>, limit = 3): string[] {
  const messages: string[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object" || messages.length >= limit) return;
    for (const value of Object.values(node)) {
      if (!value || typeof value !== "object") continue;
      if ("message" in value && typeof value.message === "string" && value.message) {
        messages.push(value.message);
      } else {
        walk(value);
      }
      if (messages.length >= limit) return;
    }
  };
  walk(errors);
  return messages;
}

function StepTitle({ step, title }: { step: number; title: string }) {
  return (
    <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-text">
      <span className="flex size-7 items-center justify-center rounded-full bg-primary-soft text-sm text-primary">
        {step}
      </span>
      {title}
    </h2>
  );
}

export function CheckoutForm({ addresses, settings, cart }: Props) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const defaultAddress = addresses.find((address) => address.isDefault) ?? addresses[0];

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: {
      shippingMethod: settings.deliveryEnabled ? "delivery" : "pickup",
      selectedAddress: defaultAddress?.id ?? "new",
      newAddress: {
        recipientName: "",
        phone: "",
        street: "",
        number: "",
        floorApt: "",
        city: "",
        province: "Buenos Aires",
        postalCode: "",
        notes: "",
        isDefault: false,
      },
    },
  });

  const shippingMethod = useWatch({ control, name: "shippingMethod" });
  const selectedAddress = useWatch({ control, name: "selectedAddress" });
  const shippingCents =
    shippingMethod === "pickup"
      ? 0
      : settings.freeShippingThresholdCents != null &&
          cart.subtotalCents >= settings.freeShippingThresholdCents
        ? 0
        : settings.shippingFlatCents;
  const totalCents = cart.subtotalCents + shippingCents;

  const onValid = (values: CheckoutFormValues) => {
    setFeedback(null);
    const isDelivery = values.shippingMethod === "delivery";
    const input = {
      shippingMethod: values.shippingMethod,
      addressId:
        isDelivery && values.selectedAddress !== "new" ? values.selectedAddress : null,
      newAddress: isDelivery && values.selectedAddress === "new" ? values.newAddress : null,
    };

    startTransition(async () => {
      try {
        const result = await createCheckout(input);
        if (!result.ok) {
          setFeedback(result.message ?? "No se pudo iniciar el pago. Intentá de nuevo.");
          return;
        }
        if (result.checkoutUrl) {
          window.location.assign(result.checkoutUrl);
          return;
        }
        setFeedback("No se pudo iniciar el pago. Intentá de nuevo.");
      } catch {
        setFeedback("No se pudo iniciar el pago. Recargá la página e intentá de nuevo.");
      }
    });
  };

  const onInvalid = (errors: FieldErrors<CheckoutFormValues>) => {
    const messages = collectValidationMessages(errors);
    setFeedback(
      messages.length > 0
        ? `Revisá estos datos: ${messages.join(" · ")}`
        : "Revisá los datos marcados en rojo y volvé a intentar.",
    );
  };

  const onSubmit = handleSubmit(onValid, onInvalid);

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-8">
        <Card className="border-border bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="border-0 bg-transparent p-0">
              <StepTitle step={1} title="¿Cómo querés recibir tu pedido?" />
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {settings.deliveryEnabled ? (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 has-checked:border-primary has-checked:bg-primary-soft/40">
                <input type="radio" value="delivery" className="mt-1" {...register("shippingMethod")} />
                <span>
                  <span className="flex items-center gap-2 font-semibold text-text">
                    <Truck className="size-4 text-primary" aria-hidden /> Envío a domicilio
                  </span>
                  <span className="mt-1 block text-sm text-text-muted">
                    {settings.freeShippingThresholdCents != null &&
                    cart.subtotalCents >= settings.freeShippingThresholdCents
                      ? "Envío gratis en esta compra"
                      : `Envío: ${formatMoney(settings.shippingFlatCents)}`}
                  </span>
                </span>
              </label>
            ) : null}
            {settings.pickupEnabled ? (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 has-checked:border-primary has-checked:bg-primary-soft/40">
                <input type="radio" value="pickup" className="mt-1" {...register("shippingMethod")} />
                <span>
                  <span className="flex items-center gap-2 font-semibold text-text">
                    <PackageCheck className="size-4 text-primary" aria-hidden /> Retiro en persona
                  </span>
                  <span className="mt-1 block text-sm text-text-muted">Sin costo de envío</span>
                </span>
              </label>
            ) : null}
            {errors.shippingMethod ? (
              <p role="alert" className="text-sm text-danger">
                {errors.shippingMethod.message}
              </p>
            ) : null}
            {shippingMethod === "pickup" && settings.pickupInstructions ? (
              <p className="rounded-xl bg-primary-soft px-3 py-2 text-sm text-primary sm:col-span-2">
                {settings.pickupInstructions}
              </p>
            ) : null}
          </CardContent>
        </Card>

        {shippingMethod === "delivery" ? (
          <Card className="border-border bg-surface shadow-sm">
            <CardHeader>
              <CardTitle className="border-0 bg-transparent p-0">
                <StepTitle step={2} title="Dirección de entrega" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {addresses.map((address) => (
                  <label
                    key={address.id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 has-checked:border-primary has-checked:bg-primary-soft/40"
                  >
                    <input
                      type="radio"
                      value={address.id}
                      className="mt-1"
                      {...register("selectedAddress")}
                    />
                    <span className="text-sm">
                      <span className="flex items-center gap-2 font-semibold text-text">
                        <MapPin className="size-4 text-primary" aria-hidden /> {address.recipientName}
                        {address.isDefault ? (
                          <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary">
                            Predeterminada
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1 block text-text-muted">
                        {address.street} {address.number}, {address.city}, {address.province}
                      </span>
                    </span>
                  </label>
                ))}
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border p-3 text-sm text-text has-checked:border-primary has-checked:bg-primary-soft/40">
                  <input type="radio" value="new" {...register("selectedAddress")} />
                  Cargar una dirección nueva
                </label>
                {errors.selectedAddress ? (
                  <p role="alert" className="text-sm text-danger">
                    {errors.selectedAddress.message}
                  </p>
                ) : null}
              </div>

              {selectedAddress === "new" ? (
                <div className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="checkout-recipient">¿Quién recibe?</Label>
                    <Input id="checkout-recipient" className="mt-1" {...register("newAddress.recipientName")} />
                    {errors.newAddress?.recipientName ? (
                      <p role="alert" className="mt-1 text-xs text-danger">
                        {errors.newAddress.recipientName.message}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <Label htmlFor="checkout-phone">Teléfono</Label>
                    <Input id="checkout-phone" type="tel" className="mt-1" {...register("newAddress.phone")} />
                    {errors.newAddress?.phone ? (
                      <p role="alert" className="mt-1 text-xs text-danger">
                        {errors.newAddress.phone.message}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <Label htmlFor="checkout-street">Calle</Label>
                    <Input id="checkout-street" className="mt-1" {...register("newAddress.street")} />
                    {errors.newAddress?.street ? (
                      <p role="alert" className="mt-1 text-xs text-danger">
                        {errors.newAddress.street.message}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <Label htmlFor="checkout-number">Número</Label>
                    <Input id="checkout-number" className="mt-1" {...register("newAddress.number")} />
                    {errors.newAddress?.number ? (
                      <p role="alert" className="mt-1 text-xs text-danger">
                        {errors.newAddress.number.message}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <Label htmlFor="checkout-floor">Piso / Depto (opcional)</Label>
                    <Input id="checkout-floor" className="mt-1" {...register("newAddress.floorApt")} />
                  </div>
                  <div>
                    <Label htmlFor="checkout-city">Ciudad</Label>
                    <Input id="checkout-city" className="mt-1" {...register("newAddress.city")} />
                    {errors.newAddress?.city ? (
                      <p role="alert" className="mt-1 text-xs text-danger">
                        {errors.newAddress.city.message}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <Label htmlFor="checkout-province">Provincia</Label>
                    <select
                      id="checkout-province"
                      className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
                      {...register("newAddress.province")}
                    >
                      {ARGENTINE_PROVINCES.map((province) => (
                        <option key={province} value={province}>
                          {province}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="checkout-postal">Código postal</Label>
                    <Input id="checkout-postal" className="mt-1" {...register("newAddress.postalCode")} />
                    {errors.newAddress?.postalCode ? (
                      <p role="alert" className="mt-1 text-xs text-danger">
                        {errors.newAddress.postalCode.message}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <Link href="/cuenta/direcciones" className="inline-block text-sm text-primary underline-offset-2 hover:underline">
                Administrar mis direcciones
              </Link>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Card className="border-border bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="border-0 bg-transparent p-0">
              <StepTitle step={shippingMethod === "delivery" ? 3 : 2} title="Resumen" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              {cart.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-3">
                  <span className="text-text-muted">
                    {item.productName} · {item.variantLabel} × {item.quantity}
                  </span>
                  <span className="shrink-0 font-medium text-text">
                    {formatMoney(item.lineTotalCents)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="space-y-1 border-t border-border pt-3 text-sm">
              <div className="flex justify-between text-text-muted">
                <span>Productos ({cart.itemCount})</span>
                <span>{formatMoney(cart.subtotalCents)}</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>Envío</span>
                <span>{shippingCents === 0 ? "Gratis" : formatMoney(shippingCents)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="font-semibold text-text">Total</span>
              <span className="font-heading text-xl font-extrabold text-primary">
                {formatMoney(totalCents)}
              </span>
            </div>

            {feedback ? (
              <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
                {feedback}
              </p>
            ) : null}

            <Button type="submit" size="lg" className="w-full" disabled={isPending}>
              {isPending ? "Generando el pago…" : "Pagar con MercadoPago"}
            </Button>
            <p className="text-xs text-text-muted">
              Te vamos a redirigir a MercadoPago para completar el pago de forma segura.
            </p>
            <Link href="/carrito" className={buttonVariants({ variant: "link", className: "w-full" })}>
              <CreditCard aria-hidden /> Volver al carrito
            </Link>
          </CardContent>
        </Card>
      </aside>
    </form>
  );
}
