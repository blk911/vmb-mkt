import CityDrillClient from "./CityDrillClient";

export default function Page({ params }: { params: { cityKey: string } }) {
  return <CityDrillClient cityKey={params.cityKey} />;
}
