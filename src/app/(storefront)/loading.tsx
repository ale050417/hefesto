import { HefestoLoader } from "@/components/shared/hefesto-loader";

export default function StorefrontLoading() {
  return (
    <div className="store-wrap flex min-h-[60vh] items-center justify-center">
      <HefestoLoader />
    </div>
  );
}
