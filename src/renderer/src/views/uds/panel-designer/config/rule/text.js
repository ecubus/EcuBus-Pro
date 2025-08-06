import {localeProps} from '../../utils';
import uniqueId from '@form-create/utils/lib/unique';

const label = '文字';
const name = 'text';

export default {
    menu: 'aide',
    icon: 'icon-span',
    label,
    name,
    rule({t}) {
        return {
            type: 'TText',
            title: '',
            field:uniqueId(),
            style: {
                whiteSpace: 'pre-line',
                width: '100%',
            },
            
        };
    },
  
    props(_, {t}) {
        return localeProps(t, name + '.props', [
             {
                title:'Content',
                type: 'input',
                field: 'initValue',
                value:'Text',
                props: {
                    type: 'textarea'
                }
            }
        ]);
    }
};

