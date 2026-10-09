## 2025-05-20 - Accessible labels for Avatar and Profile Menu Triggers
**Learning:** Topbar avatar/profile buttons often display initials or hide user name text on small viewports (`sm:hidden`). Without an explicit `aria-label`, screen readers announce an uninformative label or plain initials ("TA button").
**Action:** Always provide an explicit `aria-label="User menu"` or descriptive label on profile dropdown trigger buttons in app shell header components.
