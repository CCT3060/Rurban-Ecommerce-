import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: orders, error: oError } = await supabase
    .from('orders')
    .select('id, order_number, subtotal, tax, shipping_cost, total, order_items(price, quantity, intra_state_tax_rate)')
    .order('created_at', { ascending: false })
    .limit(1);
  
  console.log("Latest Order:", JSON.stringify(orders, null, 2));
}

main();
