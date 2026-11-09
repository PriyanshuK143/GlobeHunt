import type { AtlasLabel, LabelKind } from './types'

/**
 * Fallback only (used if the packaged atlas in public/atlas fails to load).
 * Curated atlas places (public geographic coordinates, rounded to ~0.1°).
 * Countries are generated from the Natural Earth borders; this file adds capitals,
 * major cities, oceans, seas and physical features.
 * Tuple: [name, lat, lng, countryOrRegion?]
 */
type Row = [string, number, number, string?]

const ZOOM: Partial<Record<LabelKind, number>> = {
  ocean: 4.6,
  country: 3.2,
  sea: 2.9,
  capital: 2.35,
  range: 2.6,
  desert: 2.6,
  river: 2.2,
  lake: 2.1,
  island: 2.3,
  city: 1.95,
  mountain: 1.85,
  town: 1.6,
}
const PRIORITY: Partial<Record<LabelKind, number>> = {
  ocean: 100,
  country: 80,
  capital: 60,
  sea: 55,
  range: 50,
  desert: 48,
  city: 45,
  river: 40,
  lake: 40,
  island: 38,
  mountain: 35,
  town: 20,
}

function rows(kind: LabelKind, list: Row[], opts: { zoom?: number; priority?: number; size?: number } = {}): AtlasLabel[] {
  return list.map(([name, lat, lng, country]) => ({
    id: `${kind}:${name}`,
    name,
    kind,
    lat,
    lng,
    country,
    maxDistance: opts.zoom ?? ZOOM[kind] ?? 2,
    priority: opts.priority ?? PRIORITY[kind] ?? 30,
    size: opts.size,
  }))
}

const CAPITALS: Row[] = [
  ['Washington, D.C.', 38.9, -77.04, 'United States of America'], ['Ottawa', 45.42, -75.7, 'Canada'],
  ['Mexico City', 19.43, -99.13, 'Mexico'], ['Havana', 23.11, -82.37, 'Cuba'], ['Guatemala City', 14.63, -90.51, 'Guatemala'],
  ['Panama City', 8.98, -79.52, 'Panama'], ['Bogotá', 4.71, -74.07, 'Colombia'], ['Caracas', 10.48, -66.9, 'Venezuela'],
  ['Quito', -0.18, -78.47, 'Ecuador'], ['Lima', -12.05, -77.04, 'Peru'], ['La Paz', -16.5, -68.15, 'Bolivia'],
  ['Brasília', -15.79, -47.88, 'Brazil'], ['Asunción', -25.26, -57.58, 'Paraguay'], ['Montevideo', -34.9, -56.16, 'Uruguay'],
  ['Buenos Aires', -34.6, -58.38, 'Argentina'], ['Santiago', -33.45, -70.67, 'Chile'],
  ['London', 51.51, -0.13, 'United Kingdom'], ['Dublin', 53.35, -6.26, 'Ireland'], ['Paris', 48.86, 2.35, 'France'],
  ['Madrid', 40.42, -3.7, 'Spain'], ['Lisbon', 38.72, -9.14, 'Portugal'], ['Rome', 41.9, 12.5, 'Italy'],
  ['Berlin', 52.52, 13.4, 'Germany'], ['Amsterdam', 52.37, 4.9, 'Netherlands'], ['Brussels', 50.85, 4.35, 'Belgium'],
  ['Bern', 46.95, 7.45, 'Switzerland'], ['Vienna', 48.21, 16.37, 'Austria'], ['Prague', 50.08, 14.44, 'Czechia'],
  ['Warsaw', 52.23, 21.01, 'Poland'], ['Budapest', 47.5, 19.04, 'Hungary'], ['Copenhagen', 55.68, 12.57, 'Denmark'],
  ['Oslo', 59.91, 10.75, 'Norway'], ['Stockholm', 59.33, 18.07, 'Sweden'], ['Helsinki', 60.17, 24.94, 'Finland'],
  ['Reykjavík', 64.15, -21.94, 'Iceland'], ['Athens', 37.98, 23.73, 'Greece'], ['Bucharest', 44.43, 26.1, 'Romania'],
  ['Sofia', 42.7, 23.32, 'Bulgaria'], ['Belgrade', 44.79, 20.45, 'Serbia'], ['Kyiv', 50.45, 30.52, 'Ukraine'],
  ['Minsk', 53.9, 27.56, 'Belarus'], ['Moscow', 55.76, 37.62, 'Russia'], ['Ankara', 39.93, 32.86, 'Turkey'],
  ['Cairo', 30.04, 31.24, 'Egypt'], ['Rabat', 34.02, -6.84, 'Morocco'], ['Algiers', 36.75, 3.06, 'Algeria'],
  ['Tunis', 36.81, 10.18, 'Tunisia'], ['Tripoli', 32.89, 13.19, 'Libya'], ['Khartoum', 15.5, 32.56, 'Sudan'],
  ['Addis Ababa', 9.03, 38.74, 'Ethiopia'], ['Nairobi', -1.29, 36.82, 'Kenya'], ['Dodoma', -6.16, 35.75, 'Tanzania'],
  ['Kampala', 0.35, 32.58, 'Uganda'], ['Kinshasa', -4.32, 15.31, 'Dem. Rep. Congo'], ['Luanda', -8.84, 13.23, 'Angola'],
  ['Abuja', 9.06, 7.5, 'Nigeria'], ['Accra', 5.6, -0.19, 'Ghana'], ['Dakar', 14.72, -17.47, 'Senegal'],
  ['Bamako', 12.64, -8.0, 'Mali'], ['Niamey', 13.51, 2.11, 'Niger'], ["N'Djamena", 12.13, 15.06, 'Chad'],
  ['Pretoria', -25.75, 28.19, 'South Africa'], ['Windhoek', -22.56, 17.07, 'Namibia'], ['Harare', -17.83, 31.05, 'Zimbabwe'],
  ['Lusaka', -15.39, 28.32, 'Zambia'], ['Maputo', -25.97, 32.57, 'Mozambique'], ['Antananarivo', -18.88, 47.51, 'Madagascar'],
  ['Riyadh', 24.71, 46.68, 'Saudi Arabia'], ['Tehran', 35.69, 51.39, 'Iran'], ['Baghdad', 33.31, 44.37, 'Iraq'],
  ['Damascus', 33.51, 36.29, 'Syria'], ['Amman', 31.95, 35.93, 'Jordan'], ['Abu Dhabi', 24.45, 54.38, 'United Arab Emirates'],
  ['Muscat', 23.59, 58.41, 'Oman'], ["Sana'a", 15.37, 44.19, 'Yemen'], ['Kabul', 34.53, 69.17, 'Afghanistan'],
  ['Islamabad', 33.68, 73.05, 'Pakistan'], ['New Delhi', 28.61, 77.21, 'India'], ['Kathmandu', 27.72, 85.32, 'Nepal'],
  ['Dhaka', 23.81, 90.41, 'Bangladesh'], ['Colombo', 6.93, 79.86, 'Sri Lanka'], ['Astana', 51.17, 71.45, 'Kazakhstan'],
  ['Tashkent', 41.3, 69.24, 'Uzbekistan'], ['Ulaanbaatar', 47.89, 106.91, 'Mongolia'], ['Beijing', 39.9, 116.41, 'China'],
  ['Seoul', 37.57, 126.98, 'South Korea'], ['Pyongyang', 39.04, 125.76, 'North Korea'], ['Tokyo', 35.68, 139.69, 'Japan'],
  ['Taipei', 25.03, 121.57, 'Taiwan'], ['Hanoi', 21.03, 105.85, 'Vietnam'], ['Bangkok', 13.76, 100.5, 'Thailand'],
  ['Naypyidaw', 19.76, 96.08, 'Myanmar'], ['Vientiane', 17.98, 102.63, 'Laos'], ['Phnom Penh', 11.56, 104.92, 'Cambodia'],
  ['Kuala Lumpur', 3.14, 101.69, 'Malaysia'], ['Jakarta', -6.21, 106.85, 'Indonesia'], ['Manila', 14.6, 120.98, 'Philippines'],
  ['Canberra', -35.28, 149.13, 'Australia'], ['Wellington', -41.29, 174.78, 'New Zealand'], ['Port Moresby', -9.44, 147.18, 'Papua New Guinea'],
]

const CITIES: Row[] = [
  ['New York', 40.71, -74.01, 'United States of America'], ['Los Angeles', 34.05, -118.24, 'United States of America'],
  ['Chicago', 41.88, -87.63, 'United States of America'], ['Houston', 29.76, -95.37, 'United States of America'],
  ['San Francisco', 37.77, -122.42, 'United States of America'], ['Miami', 25.76, -80.19, 'United States of America'],
  ['Seattle', 47.61, -122.33, 'United States of America'], ['Toronto', 43.65, -79.38, 'Canada'], ['Vancouver', 49.28, -123.12, 'Canada'],
  ['Montreal', 45.5, -73.57, 'Canada'], ['São Paulo', -23.55, -46.63, 'Brazil'], ['Rio de Janeiro', -22.91, -43.17, 'Brazil'],
  ['Barcelona', 41.39, 2.17, 'Spain'], ['Milan', 45.46, 9.19, 'Italy'], ['Munich', 48.14, 11.58, 'Germany'],
  ['Hamburg', 53.55, 9.99, 'Germany'], ['St Petersburg', 59.93, 30.34, 'Russia'], ['Istanbul', 41.01, 28.98, 'Turkey'],
  ['Lagos', 6.52, 3.38, 'Nigeria'], ['Johannesburg', -26.2, 28.05, 'South Africa'], ['Cape Town', -33.92, 18.42, 'South Africa'],
  ['Casablanca', 33.57, -7.59, 'Morocco'], ['Alexandria', 31.2, 29.92, 'Egypt'], ['Dubai', 25.2, 55.27, 'United Arab Emirates'],
  ['Mumbai', 19.08, 72.88, 'India'], ['Kolkata', 22.57, 88.36, 'India'], ['Chennai', 13.08, 80.27, 'India'],
  ['Bengaluru', 12.97, 77.59, 'India'], ['Karachi', 24.86, 67.0, 'Pakistan'], ['Lahore', 31.55, 74.34, 'Pakistan'],
  ['Shanghai', 31.23, 121.47, 'China'], ['Hong Kong', 22.32, 114.17, 'China'], ['Guangzhou', 23.13, 113.26, 'China'],
  ['Chengdu', 30.57, 104.07, 'China'], ['Osaka', 34.69, 135.5, 'Japan'], ['Singapore', 1.35, 103.82, 'Singapore'],
  ['Ho Chi Minh City', 10.82, 106.63, 'Vietnam'], ['Sydney', -33.87, 151.21, 'Australia'], ['Melbourne', -37.81, 144.96, 'Australia'],
  ['Perth', -31.95, 115.86, 'Australia'], ['Auckland', -36.85, 174.76, 'New Zealand'],
]

const OCEANS: Row[] = [
  ['Pacific Ocean', 0, -150], ['Pacific Ocean', 10, 160], ['Atlantic Ocean', 25, -40], ['Atlantic Ocean', -20, -15],
  ['Indian Ocean', -20, 80], ['Southern Ocean', -60, 30], ['Arctic Ocean', 82, 0],
]
const SEAS: Row[] = [
  ['Mediterranean Sea', 35.5, 18], ['Caribbean Sea', 15, -75], ['Gulf of Mexico', 25, -90], ['Arabian Sea', 15, 65],
  ['Bay of Bengal', 15, 88], ['South China Sea', 13, 114], ['East China Sea', 29, 125], ['Sea of Japan', 40, 135],
  ['Bering Sea', 58, -178], ['North Sea', 56, 3], ['Baltic Sea', 58, 19.5], ['Black Sea', 43.2, 34], ['Red Sea', 20, 38.5],
  ['Persian Gulf', 27, 51], ['Gulf of Guinea', 2, 3], ['Coral Sea', -17, 155], ['Tasman Sea', -38, 160], ['Hudson Bay', 60, -85],
  ['Barents Sea', 74, 40], ['Philippine Sea', 20, 132], ['Gulf of Alaska', 57, -145], ['Arafura Sea', -9, 135],
]
const RIVERS: Row[] = [
  ['Amazon', -3.3, -60], ['Nile', 22, 31.4], ['Mississippi', 35, -90.1], ['Yangtze', 30.4, 112.5], ['Ganges', 25.4, 83.5],
  ['Congo', -1, 18.5], ['Niger', 13.5, -2.5], ['Danube', 44.7, 22], ['Volga', 50.5, 45.6], ['Mekong', 15.5, 105.8],
  ['Indus', 27.5, 68.3], ['Yellow River', 35, 111.5], ['Paraná', -27.4, -58.7], ['Zambezi', -16.5, 28.5],
  ['Rhine', 50.5, 7.6], ['Ob', 62, 66], ['Yenisei', 63, 87.5], ['Lena', 63, 126], ['Mackenzie', 64, -125], ['Murray', -34.6, 142.5],
  ['Euphrates', 34.6, 40.9], ['Brahmaputra', 26.2, 91.5],
]
const LAKES: Row[] = [
  ['Lake Superior', 47.7, -87.5], ['Lake Michigan', 44, -87], ['Lake Huron', 44.8, -82.4], ['Lake Victoria', -1, 33],
  ['Lake Tanganyika', -6, 29.5], ['Lake Malawi', -12, 34.6], ['Lake Baikal', 53.5, 108], ['Caspian Sea', 41.5, 50.5],
  ['Aral Sea', 45, 59.5], ['Lake Titicaca', -15.8, -69.4], ['Great Bear Lake', 66, -121], ['Lake Chad', 13.2, 14.2],
  ['Lake Balkhash', 46.5, 74.5], ['Dead Sea', 31.5, 35.5], ['Lake Ladoga', 61, 31.5],
]
const RANGES: Row[] = [
  ['Himalayas', 28.5, 84], ['Andes', -20, -68.5], ['Rocky Mountains', 44, -110], ['Alps', 46.4, 9.5], ['Ural Mountains', 58, 59.5],
  ['Atlas Mountains', 31.5, -6.5], ['Appalachians', 38, -80.5], ['Caucasus', 42.7, 44], ['Tian Shan', 42, 80],
  ['Great Dividing Range', -27, 151], ['Zagros Mountains', 33, 48], ['Pyrenees', 42.7, 0.5], ['Carpathians', 47.5, 25],
  ['Hindu Kush', 35.5, 70],
]
const DESERTS: Row[] = [
  ['Sahara', 23, 12], ['Arabian Desert', 21, 48], ['Gobi Desert', 43, 105], ['Kalahari', -23, 22], ['Atacama', -24, -69.3],
  ['Great Victoria Desert', -28.5, 128], ['Thar Desert', 27, 71.5], ['Taklamakan', 38.9, 83],
]
const MOUNTAINS: Row[] = [
  ['Mount Everest', 27.99, 86.93], ['K2', 35.88, 76.51], ['Kilimanjaro', -3.07, 37.35], ['Mont Blanc', 45.83, 6.86],
  ['Aconcagua', -32.65, -70.01], ['Denali', 63.07, -151.01], ['Mount Fuji', 35.36, 138.73], ['Elbrus', 43.35, 42.44],
  ['Mount Kosciuszko', -36.46, 148.26], ['Mount Kenya', -0.15, 37.31],
]
const ISLANDS: Row[] = [
  ['Greenland', 72, -40], ['Madagascar', -19, 46.7], ['Borneo', 0.8, 114], ['Sumatra', -0.5, 101.5], ['Honshu', 36.5, 138.5],
  ['Great Britain', 54, -2.5], ['Iceland', 64.9, -18.5], ['Sri Lanka', 7.8, 80.7], ['Tasmania', -42, 146.7], ['Sicily', 37.5, 14.2],
  ['New Guinea', -5.5, 142], ['Java', -7.4, 110], ['Luzon', 16.5, 121], ['Hawaii', 19.6, -155.5], ['Cuba', 21.6, -79],
]

export const ATLAS_LABELS: AtlasLabel[] = [
  ...rows('ocean', OCEANS, { size: 1.2 }),
  ...rows('sea', SEAS),
  ...rows('capital', CAPITALS),
  ...rows('city', CITIES),
  ...rows('river', RIVERS),
  ...rows('lake', LAKES),
  ...rows('range', RANGES),
  ...rows('desert', DESERTS),
  ...rows('mountain', MOUNTAINS),
  ...rows('island', ISLANDS),
].map((l, i) => (l.kind === 'ocean' ? { ...l, id: `${l.id}:${i}` } : l))

