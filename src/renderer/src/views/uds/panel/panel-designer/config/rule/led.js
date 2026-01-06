import { localeOptions, localeProps } from '../../utils';
import ledIcon from '@iconify/icons-mdi/led-variant-outline'
import uniqueId from '@form-create/utils/lib/unique';

const label = 'Led';
const name = 'Led';

export default {
    menu: 'aide',
    icon: ledIcon,
    label,
    name,
    
    event: ['change'],
    rule({ t }) {
        return {
            field: uniqueId(),
            type: name,
            props: {
                size: 50,
                onColor: '#00ff00',
                offColor: '#666666'
            }
        };
    },
    props(_, { t }) {
        return localeProps(t, name + '.props', [
            {
                type: 'input-number',
                field: 'size',
                title: 'Size',
                props: {
                    min: 10,
                   
                }
            },
            {
                type: 'color-picker',
                field: 'onColor',
                title: 'On Color',
                value: '#00ff00'
            },
            {
                type: 'color-picker',
                field: 'offColor',
                title: 'Off Color',
                value: '#666666'
            }
        ]);
    }
}; 
