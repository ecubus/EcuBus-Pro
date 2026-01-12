import { localeProps } from '../../utils';

const label = 'Grid';
const name = 'grid';

export default {
    menu: 'layout',
    icon: 'icon-table',
    label,
    name,
    inside: false,
    mask: false,
    rule() {
        return {
            type: name,
            props: {
                rule: {
                    
                    layout: [],
                    row: 24,
                    rowHeight: 80,
                    margin: 10,
                },
               
            },
            children: []
        };
    },
    props(_, { t }) {
        return localeProps(t, name + '.props', [
            { title: 'Row Number', type: 'number', field: 'rule>row', value: 24 },
            { title: 'Item Margin', type: 'number', field: 'rule>margin', value: 10 },
            { title: 'Row Height', type: 'number', field: 'rule>rowHeight', value: 80 },

        ]);
    }
};

