import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import HotelDataForm from "./HotelDataForm";
import AlertsPanel from "./AlertsPanel";

export default function AiConciergePanel() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="rounded-2xl border border-white/10 bg-white/10 text-white backdrop-blur-xl">
        <Tabs defaultValue="hotel-data">
          <TabsList className="h-auto w-full rounded-none rounded-t-2xl border-b border-white/10 bg-white/5 p-0">
            <TabsTrigger
              value="hotel-data"
              className="flex-1 rounded-none rounded-tl-2xl py-3 text-white/60 data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              Dane o hotelu
            </TabsTrigger>
            <TabsTrigger
              value="alerts"
              className="flex-1 rounded-none rounded-tr-2xl py-3 text-white/60 data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              Alerty AI Concierge
            </TabsTrigger>
          </TabsList>
          <TabsContent value="hotel-data">
            <HotelDataForm />
          </TabsContent>
          <TabsContent value="alerts">
            <AlertsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
