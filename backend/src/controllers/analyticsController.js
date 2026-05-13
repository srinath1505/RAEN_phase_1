const prisma = require('../config/db');

exports.trackPageView = async (req, res) => {
  try {
    const { path, productId, sessionId } = req.body;

    if (!path || typeof path !== 'string' || path.trim() === '') {
      return res.status(400).json({ ok: false, reason: 'missing_path' });
    }
    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
      return res.status(400).json({ ok: false, reason: 'missing_sessionId' });
    }

    await prisma.pageView.create({
      data: {
        path: path.trim().slice(0, 2048),
        productId: productId || null,
        sessionId: sessionId.trim().slice(0, 255),
        userAgent: req.headers['user-agent']
          ? req.headers['user-agent'].slice(0, 512)
          : null,
        referer: req.headers['referer']
          ? req.headers['referer'].slice(0, 2048)
          : null,
      },
    });

    return res.status(200).json({ ok: true });
  } catch {
    return res.status(200).json({ ok: true });
  }
};

exports.trackCartEvent = async (req, res) => {
  try {
    const { event, sessionId, productId, orderId } = req.body;

    const validEvents = [
      'add_to_cart',
      'remove_from_cart',
      'checkout_started',
      'checkout_completed',
    ];

    if (!event || typeof event !== 'string' || event.trim() === '') {
      return res.status(400).json({ ok: false, reason: 'missing_event' });
    }
    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
      return res.status(400).json({ ok: false, reason: 'missing_sessionId' });
    }
    if (!validEvents.includes(event)) {
      return res.status(400).json({ ok: false, reason: 'invalid_event' });
    }

    await prisma.cartEvent.create({
      data: {
        event: event.trim(),
        sessionId: sessionId.trim().slice(0, 255),
        productId: productId || null,
        orderId: orderId || null,
      },
    });

    return res.status(200).json({ ok: true });
  } catch {
    return res.status(200).json({ ok: true });
  }
};
