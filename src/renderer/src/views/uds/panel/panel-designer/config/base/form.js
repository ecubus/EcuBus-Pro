import {localeOptions} from '../../utils';

export default function form({t}) {
    return [
        {
            type: 'input',
            field: '>formName',
            value: '',
            title: t('form.formName'),
        }, {
            type: 'radio',
            field: 'labelPosition',
            value: 'left',
            title: t('form.labelPosition'),
            options: localeOptions(t, [
                {value: 'left', label: 'left'},
                {value: 'right', label: 'right'},
                {value: 'top', label: 'top'},
            ])
        }, {
            type: 'radio',
            field: 'size',
            value: 'small',
            title: t('form.size'),
            options: localeOptions(t, [
                {value: 'large', label: 'large'},
                {value: 'default', label: 'default'},
                {value: 'small', label: 'small'},
            ])
        }, {
            type: 'input',
            field: 'labelSuffix',
            value: '',
            title: t('form.labelSuffix'),
            style: {
                width: '150px'
            }
        }, {
            type: 'SizeInput',
            field: 'labelWidth',
            value: '125px',
            title: t('form.labelWidth'),
        },
    ];
}

