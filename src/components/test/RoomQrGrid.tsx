import QRCode from "react-qr-code";

interface Room {
  room_number: string;
  qr_token: string;
}

interface Props {
  rooms: Room[];
  origin: string;
}

export default function RoomQrGrid({ rooms, origin }: Props) {
  return (
    <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {rooms.map((room) => {
        const url = `${origin}/qr/room/${room.qr_token}`;
        return (
          <div
            key={room.qr_token}
            className="border-border bg-card flex flex-col items-center gap-3 rounded-xl border p-4 shadow-sm"
          >
            <span className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">Room</span>
            <span className="text-foreground text-3xl font-bold">{room.room_number}</span>
            <div className="bg-card ring-border rounded-lg p-2 ring-1">
              <QRCode value={url} size={140} />
            </div>
            <a
              href={url}
              className="text-secondary max-w-full truncate text-xs hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {url}
            </a>
          </div>
        );
      })}
    </div>
  );
}
