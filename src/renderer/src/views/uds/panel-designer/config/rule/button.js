import { localeOptions, localeProps } from '../../utils';

const label = '按钮';
const name = 'BButton';

export default {
    menu: 'aide',
    icon: 'icon-button',
    label,
    name,
    input: true,
    event: ['change'],
    rule({ t }) {
        return {
            type: name,
            props: {
                releaseValue: 0,
                pressValue: 1,
            },
            children: [t('com.BButton.name')],
        };
    },
    props(_, { t }) {
        return localeProps(t, name + '.props', [{
            type: 'input',
            field: 'formCreateChild',
        }, {
            type: 'select',
            field: 'size',
            options: localeOptions(t, [{ label: 'large', value: 'large' }, { label: 'default', value: 'default' }, {
                label: 'small',
                value: 'small'
            }])
        }, {
            type: 'ValueInput',
            field: 'pressValue',
            title: 'Pressed Value'
        },
        {
            type: 'ValueInput',
            field: 'releaseValue',
            title: 'Released Value'
        },
        {
            type:'switch',
            field:'toggleMode',
            title:'Toogle Mode',
        },
        {
            type: 'select',
            field: 'type',
            options: [{ label: 'primary', value: 'primary' }, {
                label: 'success',
                value: 'success'
            }, { label: 'warning', value: 'warning' }, { label: 'danger', value: 'danger' }, {
                label: 'info',
                value: 'info'
            }]
        }, { type: 'switch', field: 'plain' }, {
            type: 'switch',
            field: 'round'
        }, { type: 'switch', field: 'circle' }, {
            type: 'switch',
            field: 'loading'
        }, { type: 'switch', field: 'disabled' }]);
    }
};

