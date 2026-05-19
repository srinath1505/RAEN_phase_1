/**
 * RAEN Cookie Consent — GDPR-compliant banner
 * Blocks GA4 + Meta Pixel until user accepts.
 * Stores choice in localStorage under 'raen_cookie_consent'.
 */
(function () {
    var CONSENT_KEY = 'raen_cookie_consent';
    var stored = localStorage.getItem(CONSENT_KEY);

    // Re-apply block if consent not given (guard also runs inline in <head>)
    if (stored !== 'accepted') {
        window.dataLayer = window.dataLayer || { push: function () {} };
        if (window.gtag && typeof window.gtag === 'function') {
            window._raen_gtag_real = window.gtag;
        }
        window.gtag = function () {};
        if (window.fbq && typeof window.fbq === 'function') {
            window._raen_fbq_real = window.fbq;
        }
        window.fbq = function () {};
    }

    // If already accepted, restore real tracking (in case scripts already ran)
    if (stored === 'accepted') {
        _activateTracking();
        return; // no banner needed
    }

    // If explicitly declined, nothing to do
    if (stored === 'declined') return;

    // ── Show banner on first visit ────────────────────────────────
    function showBanner() {
        var banner = document.createElement('div');
        banner.id = 'raen-cookie-banner';
        banner.setAttribute('role', 'dialog');
        banner.setAttribute('aria-label', 'Cookie consent');
        banner.style.cssText = [
            'position:fixed', 'bottom:0', 'left:0', 'right:0', 'z-index:9999',
            'background:#1a1a1a', 'color:#f9f9f9',
            'padding:20px 32px', 'display:flex', 'align-items:center',
            'justify-content:space-between', 'gap:24px', 'flex-wrap:wrap',
            'border-top:1px solid #333',
            'font-family:"Work Sans",Helvetica,sans-serif',
            'box-shadow:0 -4px 24px rgba(0,0,0,0.3)',
            'transform:translateY(100%)',
            'transition:transform 0.4s cubic-bezier(0.25,0.46,0.45,0.94)'
        ].join(';');

        banner.innerHTML = [
            '<div style="flex:1;min-width:240px;">',
            '  <p style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#b8960c;margin-bottom:6px;">Cookie Preferences</p>',
            '  <p style="font-size:12px;color:#c6c6c6;line-height:1.6;max-width:640px;">',
            '    We use cookies for analytics (GA4) and retargeting (Meta Pixel) to improve your experience.',
            '    You can accept all cookies or decline non-essential ones.',
            '    <a href="privacy-policy.html" style="color:#b8960c;border-bottom:1px solid #b8960c;text-decoration:none;margin-left:4px;font-size:11px;">Privacy Policy</a>',
            '  </p>',
            '</div>',
            '<div style="display:flex;gap:12px;flex-shrink:0;align-items:center;">',
            '  <button id="raen-cookie-decline" style="',
            '    padding:9px 20px;background:transparent;color:#999;',
            '    border:1px solid #444;font-size:10px;letter-spacing:0.15em;',
            '    text-transform:uppercase;cursor:pointer;font-family:inherit;',
            '    transition:border-color 0.15s,color 0.15s;">',
            '    Decline',
            '  </button>',
            '  <button id="raen-cookie-accept" style="',
            '    padding:9px 24px;background:#b8960c;color:#fff;border:1px solid #b8960c;',
            '    font-size:10px;letter-spacing:0.15em;text-transform:uppercase;',
            '    cursor:pointer;font-family:inherit;transition:opacity 0.15s;">',
            '    Accept All',
            '  </button>',
            '</div>'
        ].join('');

        document.body.appendChild(banner);

        // Animate in
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                banner.style.transform = 'translateY(0)';
            });
        });

        // Hover states
        var declineBtn = document.getElementById('raen-cookie-decline');
        var acceptBtn = document.getElementById('raen-cookie-accept');
        declineBtn.addEventListener('mouseover', function () { this.style.borderColor = '#888'; this.style.color = '#ccc'; });
        declineBtn.addEventListener('mouseout', function () { this.style.borderColor = '#444'; this.style.color = '#999'; });
        acceptBtn.addEventListener('mouseover', function () { this.style.opacity = '0.85'; });
        acceptBtn.addEventListener('mouseout', function () { this.style.opacity = '1'; });

        declineBtn.addEventListener('click', function () { _handleDecline(banner); });
        acceptBtn.addEventListener('click', function () { _handleAccept(banner); });
    }

    function _dismissBanner(banner) {
        banner.style.transform = 'translateY(100%)';
        setTimeout(function () { if (banner.parentNode) banner.parentNode.removeChild(banner); }, 420);
    }

    function _handleAccept(banner) {
        localStorage.setItem(CONSENT_KEY, 'accepted');
        _dismissBanner(banner);
        _activateTracking();
    }

    function _handleDecline(banner) {
        localStorage.setItem(CONSENT_KEY, 'declined');
        _dismissBanner(banner);
    }

    function _activateTracking() {
        // Restore real gtag if blocked
        if (window._raen_gtag_real) {
            window.gtag = window._raen_gtag_real;
        } else if (!window._raen_tracking_loaded) {
            // Dynamically initialize GA4
            window.dataLayer = window.dataLayer || [];
            window.gtag = function () { window.dataLayer.push(arguments); };
            window.gtag('js', new Date());
            // GA4 measurement ID — replace G-XXXXXXXXXX with real ID before launch
            var gaId = 'G-XXXXXXXXXX';
            if (gaId !== 'G-XXXXXXXXXX') {
                var gaScript = document.createElement('script');
                gaScript.async = true;
                gaScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + gaId;
                document.head.appendChild(gaScript);
                window.gtag('config', gaId);
            }
        }

        // Restore real fbq if blocked
        if (window._raen_fbq_real) {
            window.fbq = window._raen_fbq_real;
        } else if (!window._raen_tracking_loaded) {
            // Dynamically initialize Meta Pixel — replace 1234567890 with real Pixel ID
            var pixelId = '1234567890';
            if (pixelId !== '1234567890') {
                (function (f, b, e, v, n, t, s) {
                    if (f.fbq) return;
                    n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
                    if (!f._fbq) f._fbq = n;
                    n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
                    t = b.createElement(e); t.async = true; t.src = v;
                    s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
                }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js'));
                window.fbq('init', pixelId);
                window.fbq('track', 'PageView');
            }
        }

        window._raen_tracking_loaded = true;
    }

    // Show banner when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', showBanner);
    } else {
        showBanner();
    }
})();
