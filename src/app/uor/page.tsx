// app/uor/page.tsx
import ClientLocalizationWrapper from '@/app/components/ClientLocalizationWrapper';
import { PdfGenerator } from '@/app/components/PdfGenerator';

export default function UorGeneratePage() {
    return (
        <main className="min-h-screen p-8">
            <ClientLocalizationWrapper>
                <PdfGenerator />
            </ClientLocalizationWrapper>
        </main>
    );
}
