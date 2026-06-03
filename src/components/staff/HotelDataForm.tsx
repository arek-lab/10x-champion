import { useState } from "react";
import { Building2, MapPin, Clock } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { hotelContext } from "@/lib/hotel-context";
import { cn } from "@/lib/utils";

const textareaBase =
  "w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-ring transition-colors resize-none";

const labelClass = "mb-1 block text-sm text-sidebar-foreground/80";

export default function HotelDataForm() {
  const [name, setName] = useState(hotelContext.name);
  const [address, setAddress] = useState(hotelContext.address);
  const [checkInTime, setCheckInTime] = useState(hotelContext.checkInTime);
  const [checkOutTime, setCheckOutTime] = useState(hotelContext.checkOutTime);
  const [amenities, setAmenities] = useState(hotelContext.amenities.join("\n"));
  const [nearbyRestaurants, setNearbyRestaurants] = useState(hotelContext.nearbyRestaurants.join("\n"));
  const [localAttractions, setLocalAttractions] = useState(hotelContext.localAttractions.join("\n"));
  const [houseRules, setHouseRules] = useState(hotelContext.houseRules.join("\n"));
  const [saved, setSaved] = useState(false);

  function handleSave(e: React.SyntheticEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
    }, 2000);
  }

  return (
    <form onSubmit={handleSave} className="space-y-4 p-6">
      <FormField
        id="hotel-name"
        label="Nazwa hotelu"
        value={name}
        onChange={setName}
        icon={<Building2 className="size-4" />}
        variant="dark"
      />
      <FormField
        id="hotel-address"
        label="Adres"
        value={address}
        onChange={setAddress}
        icon={<MapPin className="size-4" />}
        variant="dark"
      />
      <div className="grid grid-cols-2 gap-4">
        <FormField
          id="check-in-time"
          label="Check-in"
          value={checkInTime}
          onChange={setCheckInTime}
          icon={<Clock className="size-4" />}
          variant="dark"
        />
        <FormField
          id="check-out-time"
          label="Check-out"
          value={checkOutTime}
          onChange={setCheckOutTime}
          icon={<Clock className="size-4" />}
          variant="dark"
        />
      </div>
      <div>
        <label htmlFor="amenities" className={labelClass}>
          Udogodnienia
        </label>
        <textarea
          id="amenities"
          value={amenities}
          onChange={(e) => {
            setAmenities(e.target.value);
          }}
          rows={5}
          className={cn(textareaBase)}
        />
      </div>
      <div>
        <label htmlFor="nearby-restaurants" className={labelClass}>
          Pobliskie restauracje
        </label>
        <textarea
          id="nearby-restaurants"
          value={nearbyRestaurants}
          onChange={(e) => {
            setNearbyRestaurants(e.target.value);
          }}
          rows={4}
          className={cn(textareaBase)}
        />
      </div>
      <div>
        <label htmlFor="local-attractions" className={labelClass}>
          Atrakcje lokalne
        </label>
        <textarea
          id="local-attractions"
          value={localAttractions}
          onChange={(e) => {
            setLocalAttractions(e.target.value);
          }}
          rows={5}
          className={cn(textareaBase)}
        />
      </div>
      <div>
        <label htmlFor="house-rules" className={labelClass}>
          Regulamin hotelu
        </label>
        <textarea
          id="house-rules"
          value={houseRules}
          onChange={(e) => {
            setHouseRules(e.target.value);
          }}
          rows={5}
          className={cn(textareaBase)}
        />
      </div>
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          className="rounded-lg bg-white/10 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
        >
          Zapisz
        </button>
        {saved && <span className="text-sm text-green-400">✓ Zapisano</span>}
      </div>
    </form>
  );
}
