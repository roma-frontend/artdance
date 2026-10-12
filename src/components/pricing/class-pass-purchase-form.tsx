interface ClassPassPurchaseFormProps {
  label: string;
}

/** No purchase control is shown until verified payment is integrated. */
export function ClassPassPurchaseForm({ label }: ClassPassPurchaseFormProps) {
  return (
    <p className="text-caption mt-6 break-words text-content-tertiary">
      {label}
    </p>
  );
}
