import { Webhook } from 'svix';
import { NextResponse } from 'next/server';

const CLERK_WEBHOOK_SECRET: string = process.env.CLERK_WEBHOOK_SECRET as string;

if (!CLERK_WEBHOOK_SECRET) {
  throw new Error(
    'CLERK_WEBHOOK_SECRET is not defined in environment variables'
  );
}

export async function POST(request: Request) {
  const headers = request.headers;

  const svix_id = headers.get('svix-id');
  const svix_timestamp = headers.get('svix-timestamp');
  const svix_signature = headers.get('svix-signature');

  // Проверяем наличие всех необходимых заголовков
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json(
      { error: 'Missing Svix headers' },
      { status: 400 }
    );
  }

  const body = await request.text();

  const webhook = new Webhook(CLERK_WEBHOOK_SECRET);

  let msg: string | unknown = ''; // Используем unknown, чтобы потом проверить тип данных

  try {
    // Верифицируем вебхук
    msg = webhook.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    });
  } catch (err) {
    console.error('Webhook verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Проверяем и парсим результат в зависимости от того, что пришло
  if (typeof msg === 'string') {
    try {
      const payload = JSON.parse(msg);
      // Теперь payload имеет тип объекта, с которым можно работать
      if (payload.type === 'user.created') {
        const userId = payload.data.id;
        const firstName = payload.data.first_name || 'Unknown';
        const lastName = payload.data.last_name || '';

        console.log(`New user created: ${userId} (${firstName} ${lastName})`);
        // Логика создания/обновления пользователя и т.д.
      }
    } catch (parseError) {
      console.error('Failed to parse webhook payload:', parseError);
      return NextResponse.json(
        { error: 'Failed to parse webhook payload' },
        { status: 400 }
      );
    }
  } else {
    console.error('Invalid payload format:', msg);
    return NextResponse.json(
      { error: 'Invalid payload format' },
      { status: 400 }
    );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
