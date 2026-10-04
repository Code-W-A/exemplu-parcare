import { redirect } from "next/navigation"

/**
 * Pagina publică de confirmare a plății nu face parte din livrarea demo.
 * Redirecționarea server-side evită încărcarea Firebase/Stripe la prerender.
 */
export default function ConfirmarePage() {
  redirect("/admin/login")
}
