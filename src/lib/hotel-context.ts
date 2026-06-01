export const hotelContext = {
  name: "Hotel Pilot",
  address: "ul. Hotelowa 1, 00-001 Warszawa",
  checkInTime: "15:00",
  checkOutTime: "11:00",
  amenities: [
    "Outdoor pool (open 7:00–22:00)",
    "Sauna and steam room (open 8:00–21:00)",
    "Fitness centre (open 6:00–23:00)",
    "Free Wi-Fi throughout the property",
    "On-site restaurant (breakfast 7:00–10:30, dinner 18:00–22:00)",
    "Room service (available 7:00–23:00)",
    "Concierge desk (open 8:00–20:00)",
    "Secure underground parking",
    "Laundry and dry-cleaning service (request before 9:00 for same-day)",
  ],
  nearbyRestaurants: [
    "Restauracja Złoty Talerz — 200 m, Polish cuisine, open 12:00–23:00",
    "Sushi Hana — 350 m, Japanese cuisine, open 13:00–22:00",
    "Café Verde — 100 m, coffee and light meals, open 7:00–20:00",
    "Pizza Roma — 400 m, Italian, open 11:00–24:00",
  ],
  localAttractions: [
    "Old Town Market Square — 1.2 km, 15-minute walk",
    "National Museum — 800 m, open Tue–Sun 10:00–18:00",
    "Royal Gardens — 600 m, open daily sunrise to sunset",
    "Central Park — 500 m, jogging paths and outdoor gym",
    "City Bus Tour departure — 300 m, every 30 min 9:00–17:00",
  ],
  houseRules: [
    "Quiet hours: 22:00–8:00",
    "Smoking permitted only in designated outdoor areas",
    "Pets are not allowed on the property",
    "Check-in from 15:00; early check-in subject to availability",
    "Check-out by 11:00; late check-out available on request (fee may apply)",
    "Towels and linens changed every third day; request daily service at reception",
  ],
};

export function buildSystemPrompt(guest: { roomNumber: string; checkOutDate: string }): string {
  const h = hotelContext;
  return `You are the AI concierge assistant for ${h.name}, located at ${h.address}.
You help guests with hotel-specific questions. Always base your answers on the information provided below.
Do not give generic internet answers — if the information isn't listed here, say you don't know and suggest the guest contact the front desk.
Keep replies concise and friendly.

Guest details:
- Room number: ${guest.roomNumber}
- Check-out date: ${guest.checkOutDate}

Hotel information:
- Check-in: ${h.checkInTime} | Check-out: ${h.checkOutTime}

Amenities:
${h.amenities.map((a) => `- ${a}`).join("\n")}

Nearby restaurants:
${h.nearbyRestaurants.map((r) => `- ${r}`).join("\n")}

Local attractions:
${h.localAttractions.map((a) => `- ${a}`).join("\n")}

House rules:
${h.houseRules.map((r) => `- ${r}`).join("\n")}`;
}
