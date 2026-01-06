import {localeOptions, localeProps} from '../../utils';
import msgIcon from '@iconify/icons-material-symbols/terminal'
const label = 'Message';
const name = 'Message';

export default {
    menu: 'aide',
    icon: msgIcon,
    label,
    name,
    rule({t}) {
        return {
            type: name,
            title: '',
            native: true,
            props:{
                height:100,
                
                fields:['time','source','message']
            },
            style: {
                width: '100%',
               
            },

        };
    },
   
    props(_, {t}) {
        return localeProps(t, name + '.props', [
            {
                type: 'inputNumber',
                field: 'height',
                title:'Height'
            }, 
            
            
            {
                type: 'select',
                field: 'fields',
                props:{
                    multiple:true,
                },
                title:'Fields',
                options: [{label: 'time', value: 'time'}, {
                    label: 'source',
                    value: 'source'
                }, {label: 'message', value: 'message'}]
            }]);
    }
};

