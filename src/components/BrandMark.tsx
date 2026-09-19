/** The Accord logo: interlocking accord loop with a central evidentiary anchor. */
export default function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} fill="none" aria-hidden="true">
      <rect width="48" height="48" rx="12" fill="#141416" stroke="#232327" strokeWidth="1.5" />
      <circle cx="24" cy="13" r="2.5" fill="#00E5FF" />
      <path d="M24 15.5V23" stroke="#00E5FF" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 21C14 18.5 18 17.5 24 17.5C30 17.5 34 18.5 34 21" stroke="#00E5FF" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="0.5 3.5" />
      <path d="M13 22L17 30M35 22L31 30" stroke="#00E5FF" strokeWidth="1.5" strokeOpacity="0.7" strokeLinecap="round" />
      <path d="M16 32C13.2386 32 11 29.7614 11 27C11 24.2386 13.2386 22 16 22C19.5 22 22 25.5 24 27.5C26 25.5 28.5 22 32 22C34.7614 22 37 24.2386 37 27C37 29.7614 34.7614 32 32 32C28.5 32 26 28.5 24 26.5C22 28.5 19.5 32 16 32Z" stroke="#00E5FF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy="27" r="1.75" fill="#FAFAFA" />
    </svg>
  );
}
