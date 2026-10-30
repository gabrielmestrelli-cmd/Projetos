import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdsConsent, onAdsConsentChange, setAdsConsent, type AdsConsent } from '../lib/metaPixel';
import { maskPhone, whatsappLink } from '../lib/phone';

// Política de privacidade da Lev&Fit. Descreve o site como ele funciona de verdade (ver CLAUDE.md):
// se o tratamento de dados mudar (novo serviço, prazo de guarda etc.), atualize este texto.
// O contato é o WhatsApp comercial do perfil da loja (o mesmo dos botões do site).

export function PrivacyPage({ phone }: { phone: string }) {
  const [consent, setConsent] = useState<AdsConsent>(() => getAdsConsent());
  useEffect(() => onAdsConsentChange(setConsent), []);
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const status =
    consent === 'granted' ? 'Você aceitou os cookies de publicidade.'
      : consent === 'denied' ? 'Você recusou os cookies de publicidade.'
        : 'Você ainda não escolheu.';

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 text-sm leading-relaxed text-slate-700">
      <Link to="/" className="text-sm font-semibold text-green-700">← Voltar ao cardápio</Link>
      <h1 className="mt-4 text-2xl font-black text-slate-900">Privacidade e cookies</h1>
      <p className="mt-1 text-xs text-slate-400">Última atualização: 30/10/2026</p>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-bold text-slate-900">Suas escolhas de cookies</h2>
        <p className="mt-1">{status} Você pode mudar quando quiser.</p>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => setAdsConsent('denied')}
            className={`h-10 flex-1 rounded-xl border text-sm font-semibold ${consent === 'denied' ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>
            Recusar publicidade
          </button>
          <button type="button" onClick={() => setAdsConsent('granted')}
            className={`h-10 flex-1 rounded-xl text-sm font-bold ${consent === 'granted' ? 'bg-green-700 text-white' : 'bg-green-600 text-white'}`}>
            Aceitar publicidade
          </button>
        </div>
      </section>

      <h2 className="mt-8 text-base font-bold text-slate-900">Quem somos</h2>
      <p className="mt-1">
        Lev&Fit, marmitas congeladas da Grande Florianópolis. Responsável pelos dados: 60.363.847 Victor Hugo
        Bitencourt Conti, CNPJ 60.363.847/0001-62. Contato sobre privacidade: WhatsApp{' '}
        <a href={whatsappLink(phone)} target="_blank" rel="noreferrer" className="font-semibold text-green-700 underline underline-offset-2">
          {maskPhone(phone)}
        </a>.
      </p>

      <h2 className="mt-6 text-base font-bold text-slate-900">Dados do pedido</h2>
      <p className="mt-1">
        Para fazer um pedido pedimos nome, WhatsApp, endereço de entrega, forma de pagamento e, se você quiser, observações.
        Esses dados, junto com os itens escolhidos, são gravados no nosso sistema de pedidos (Supabase) e enviados para a
        loja pelo WhatsApp, para combinar a entrega e o pagamento. O telefone também serve para você ver seus pedidos em
        "Meus pedidos" e para conferir o cupom de primeiro pedido.
      </p>
      <p className="mt-2">
        A mensagem do pedido é enviada pelo seu próprio WhatsApp, então ela também passa pelo WhatsApp (Meta) e fica na
        conversa com a loja.
      </p>
      <p className="mt-2">
        Os dados dos pedidos ficam guardados no nosso sistema, hospedado no Brasil (São Paulo), enquanto forem necessários
        para atender o pedido e para cumprir obrigações legais e fiscais, e podem ser excluídos a seu pedido quando não
        houver obrigação de guardá-los.
      </p>

      <h2 className="mt-6 text-base font-bold text-slate-900">Endereço e localização</h2>
      <p className="mt-1">
        Para calcular a entrega, o CEP digitado é consultado nos serviços ViaCEP e BrasilAPI, e o endereço é localizado
        no mapa pelo OpenStreetMap (Nominatim), com a distância calculada pelo OSRM. Se você tocar em "Usar minha
        localização", o navegador pede sua permissão; as coordenadas são usadas para esse cálculo, ficam salvas no seu
        aparelho e vão como link do mapa na mensagem do pedido, para facilitar a entrega. Elas não são gravadas no
        nosso sistema de pedidos.
      </p>

      <h2 className="mt-6 text-base font-bold text-slate-900">O que fica no seu navegador</h2>
      <p className="mt-1">
        Para você não precisar digitar tudo de novo, o site guarda no seu próprio aparelho o carrinho, o nome, o WhatsApp,
        o endereço (e a localização, se você usou) e a sua escolha sobre cookies. Você pode apagar esses dados limpando os dados do site no navegador.
      </p>

      <h2 className="mt-6 text-base font-bold text-slate-900">Cookies de publicidade (Meta Pixel)</h2>
      <p className="mt-1">
        Só se você aceitar, usamos o Meta Pixel (Facebook/Instagram) para medir nossos anúncios. Ele registra quando você
        abre o cardápio, vê um produto, adiciona ao carrinho, toca no WhatsApp para tirar dúvidas e envia um pedido, com
        os produtos e valores. Não enviamos à Meta seu nome, telefone, endereço ou observações. A Meta pode guardar um
        cookie no seu navegador (_fbp). Se você recusar ou retirar o consentimento, o site para de enviar esses dados e
        apaga esse cookie.
      </p>

      <h2 className="mt-6 text-base font-bold text-slate-900">Outros serviços</h2>
      <p className="mt-1">
        O site fica hospedado na Vercel. Algumas fotos de produtos vêm do Unsplash, e os stories vêm do Instagram da loja.
      </p>

      <h2 className="mt-6 text-base font-bold text-slate-900">Seus direitos</h2>
      <p className="mt-1">
        Pela LGPD, você pode pedir para ver, corrigir ou apagar seus dados, entre outros direitos. Basta falar com a
        gente pelo WhatsApp informado acima.
      </p>
    </div>
  );
}
