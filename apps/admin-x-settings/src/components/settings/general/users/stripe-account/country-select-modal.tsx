import React, { useState } from 'react';
import NiceModal, { useModal } from '@ebay/nice-modal-react';
import { Modal, Select } from '@tryghost/admin-x-design-system';
import { getData } from 'country-list';

const countries = getData().map(country => ({
    value: country.code,
    label: country.name,
}));

interface CountrySelectModalProps {
    onConfirm: (country: string) => void;
}

const CountrySelectModal = NiceModal.create(({ onConfirm }: CountrySelectModalProps) => {
    const modal = useModal();
    const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

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
            <div className="flex flex-col gap-4 mt-6">
                <Select
                    options={countries}
                    prompt="Select country"
                    selectedOption={countries.find(c => c.value === selectedCountry)}
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
