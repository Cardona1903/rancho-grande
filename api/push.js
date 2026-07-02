import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

webpush.setVapidDetails(
  'mailto:carlos.cardona28426@ucaldas.edu.co',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { titulo, cuerpo } = req.body;
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth');

  const resultados = await Promise.allSettled(
    (subs || []).map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ titulo, cuerpo })
      )
    )
  );

  const fallidos = resultados
    .map((r, i) => r.status === 'rejected' ? subs[i].endpoint : null)
    .filter(Boolean);
  if (fallidos.length > 0) {
    await supabase.from('push_subscriptions')
      .delete().in('endpoint', fallidos);
  }
  res.status(200).json({ enviados: subs?.length || 0 });
}
