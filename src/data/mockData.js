export const STEP_LABELS = [
  { n: '01', l: 'URL' },
  { n: '02', l: 'DEVELOP' },
  { n: '03', l: 'BRAND KIT' },
  { n: '04', l: 'PROMPT' },
  { n: '05', l: 'IMAGES' },
  { n: '06', l: 'CAPTION' },
  { n: '07', l: 'CONNECT' },
  { n: '08', l: 'DASHBOARD' },
];

export const ANALYSIS_ITEMS = [
  'Reading site pages',
  'Extracting brand colors & logo',
  'Identifying products & offers',
  'Learning your tone of voice',
];

export const MOCK_BRAND_KIT = {
  businessName: 'North Brew Coffee',
  url: 'northbrewcoffee.com',
  colors: ['#2B4C3F', '#C97B3D', '#F4EFE6', '#1A1A1A'],
  summary:
    'North Brew Coffee — a small-batch coffee roaster and café. Sells single-origin beans, subscriptions, and brewing gear. Tone is warm, unpretentious, community-focused.',
  products: [
    'Ethiopia Yirgacheffe — $18',
    'Colombia Reserve — $16',
    'Monthly subscription',
    'Pour-over kit',
  ],
};

export const MOCK_CONCEPT = {
  title: 'Product highlight: Ethiopia Yirgacheffe bag, morning light, promoting the new-customer discount.',
  prompt:
    'Overhead shot of a matte kraft coffee bag labeled "Ethiopia Yirgacheffe" on a rustic wood table, soft morning window light from the left, a few scattered coffee beans and a steaming ceramic cup nearby, warm forest-green and terracotta color palette, shallow depth of field, minimal and editorial, space reserved top-right for a small "15% off first order" badge.',
};

export const MOCK_IMAGES = [
  { id: 'a', label: 'Overhead / warm light', gradient: 'from-zinc-700 to-zinc-900' },
  { id: 'b', label: 'Angled / cup in frame', gradient: 'from-orange-950 to-zinc-900' },
  { id: 'c', label: 'Close crop / beans', gradient: 'from-yellow-950 to-zinc-900' },
];

export const MOCK_CAPTION = {
  text: "Mornings are better with something worth waking up for. Our Ethiopia Yirgacheffe just landed — bright, floral, a little bit of citrus. New here? Take 15% off your first bag, link in bio.",
  hashtags: '#specialtycoffee #ethiopiacoffee #smallbatchroaster #coffeelovers',
};

export const MOCK_HISTORY = [
  { date: 'Today', status: 'pending' },
  { date: 'Jul 16', status: 'posted' },
  { date: 'Jul 15', status: 'posted' },
  { date: 'Jul 14', status: 'posted' },
  { date: 'Jul 13', status: 'posted' },
  { date: 'Jul 12', status: 'posted' },
  { date: 'Jul 11', status: 'posted' },
  { date: 'Jul 10', status: 'posted' },
];
