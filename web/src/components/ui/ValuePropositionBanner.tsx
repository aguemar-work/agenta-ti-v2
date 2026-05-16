import { X } from 'lucide-react';
import { useState } from 'react';

import { trackFeatureDiscovery } from '@/lib/analytics';
import { dismissValueProp, isValuePropDismissed } from '@/lib/onboarding';

type Props = {
  userId: string;
  feature: string;
  title: string;
  description: string;
};

export function ValuePropositionBanner({ userId, feature, title, description }: Props) {
  const [visible, setVisible] = useState(() => !isValuePropDismissed(userId, feature));

  if (!visible) return null;

  function dismiss() {
    dismissValueProp(userId, feature);
    trackFeatureDiscovery(feature, 'banner_dismiss');
    setVisible(false);
  }

  return (
    <aside className="mc-value-prop-banner" role="note" aria-label={title}>
      <div className="mc-value-prop-banner-inner">
        <div>
          <p className="mc-value-prop-banner-title">{title}</p>
          <p className="mc-value-prop-banner-desc">{description}</p>
        </div>
        <button
          type="button"
          className="mc-value-prop-banner-close"
          onClick={dismiss}
          aria-label="Ocultar mensaje"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
    </aside>
  );
}
