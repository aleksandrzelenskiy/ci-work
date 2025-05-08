'use client';

import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Font
} from '@react-pdf/renderer';

Font.register({
    family: 'Roboto',
    src: '/fonts/Roboto-Regular.ttf',
});

const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontSize: 12,
        fontFamily: 'Roboto',
    },
    title: {
        fontSize: 14,
        marginBottom: 20,
        textAlign: 'center',
        fontWeight: 'bold',
    },
    centeredLine: {
        textAlign: 'center',
        marginBottom: 10,
    },
    spacedLine: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    section: {
        marginBottom: 10,
        lineHeight: 1.5,
    },
    signature: {
        marginTop: 40,
    }
});

interface Props {
    orderNumber: string;
    orderDate: string;
    completionDate: string;
    objectNumber: string;
    objectAddress: string;
}

export const PdfTemplate = ({
                                orderNumber,
                                orderDate,
                                completionDate,
                                objectNumber,
                                objectAddress
                            }: Props) => (
    <Document>
        <Page size="A4" style={styles.page}>
            <Text style={styles.title}>
                УВЕДОМЛЕНИЕ О ГОТОВНОСТИ СДАЧИ РЕЗУЛЬТАТОВ РАБОТ ЗАКАЗЧИКУ
            </Text>

            <Text style={styles.centeredLine}>
                к Заказу № {orderNumber} от {orderDate}
            </Text>

            <View style={styles.spacedLine}>
                <Text>г. Иркутск</Text>
                <Text>«{completionDate}»</Text>
            </View>

            <View style={styles.section}>
                <Text>ООО &quot;Эверест&quot;, юридическое лицо, зарегистрированное по адресу:</Text>
                <Text>672039, Забайкальский край, г. Чита, ул. Красноярская, 32А, стр. 1, этаж 4, пом. 10</Text>
                <Text>в лице Директора Гераськова А.С., действующего на основании Устава,</Text>
                <Text>настоящим уведомляет ООО «Т2 Мобайл» о готовности сдачи результатов работ</Text>
                <Text>датой «{completionDate}» по Объекту {objectNumber}, расположенному по адресу:</Text>
                <Text>{objectAddress}</Text>
            </View>

            <View style={styles.signature}>
                <Text>ПОДРЯДЧИК</Text>
                <Text>Директор ООО «Эверест»</Text>
                <Text> </Text>
                <Text>_______________________ / Гераськов А.С. /</Text>
            </View>
        </Page>
    </Document>
);
