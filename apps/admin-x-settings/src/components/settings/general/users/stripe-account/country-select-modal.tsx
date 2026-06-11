import NiceModal, {useModal} from '@ebay/nice-modal-react';
import {Modal, Select} from '@tryghost/admin-x-design-system';
import {countries} from './countries';
import {useState} from 'react';

const countryOptions: any[] | null = countries.map(country => ({
    value: country.code,
    label: country.name
}));

interface CountrySelectModalProps {
    onConfirm: (country: string) => void;
}

const CountrySelectModal = NiceModal.create(({onConfirm}: CountrySelectModalProps) => {
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
            okDisabled={!selectedCountry}
            okLabel="Confirm"
            scrolling={false}
            size="sm"
            title="Select Country"
            onCancel={() => modal.remove()}
            onOk={handleConfirm}
        >
            <div className="mt-2 flex flex-col gap-6">
                <div className="text-sm text-[rgba(0,0,0,0.8)]">Supports Singapore only</div>
                <Select
                    isSearchable={true}
                    menuPlacement="bottom"
                    menuPosition="fixed"
                    options={countryOptions}
                    prompt="Select country"
                    selectedOption={countryOptions.find((c: any) => c.value === selectedCountry)}
                    fullWidth
                    onSelect={option => setSelectedCountry(option?.value || null)}
                />
            </div>
        </Modal>
    );
});

export default CountrySelectModal;
