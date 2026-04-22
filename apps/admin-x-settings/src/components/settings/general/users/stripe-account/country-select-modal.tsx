import { useState } from 'react';
import NiceModal, { useModal } from '@ebay/nice-modal-react';
import { Modal, Select } from '@tryghost/admin-x-design-system';
import { countries } from "./countries";

const countryOptions: any[] | null = countries.map(country => ({
    value: country.code,
    label: country.name,
}));

interface CountrySelectModalProps {
    onConfirm: (country: string) => void;
}

const CountrySelectModal = NiceModal.create(({ onConfirm }: CountrySelectModalProps) => {
    const modal = useModal();
    const [selectedCountry, setSelectedCountry] = useState<string | null>('SG');

    const handleConfirm = () => {
        if (selectedCountry) {
            onConfirm(selectedCountry);
            modal.remove();
        }
    };

    return (
        <Modal
            size="sm"
            title="Select Country"
            okLabel="Confirm"
            onOk={handleConfirm}
            okDisabled={!selectedCountry}
            onCancel={() => modal.remove()}
            scrolling={false}
        >
            <div className="flex flex-col gap-6 mt-2">
                <div className="text-sm text-[rgba(0,0,0,0.8)]">Supports Singapore only</div>
                <Select
                    options={countryOptions}
                    prompt="Select country"
                    selectedOption={countryOptions.find((c: any) => c.value === selectedCountry)}
                    onSelect={(option) => setSelectedCountry(option?.value || null)}
                    isSearchable={true}
                    fullWidth
                    menuPosition="fixed"
                    menuPlacement="bottom"
                />
            </div>
        </Modal>
    );
});

export default CountrySelectModal;
