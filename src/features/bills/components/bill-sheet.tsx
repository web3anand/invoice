import { GstSheet } from "@/features/bills/components/gst-sheet";
import {
  MIN_BODY_ROWS,
  type Bill,
  type Profile,
  billWords,
  billAdvance,
  billBalance,
  declarationFor,
  docTitle,
  footerLine,
  lineAmount,
  numberLabel,
  printSq,
  sheetTitle,
  sizeLabel,
  filledSizes,
  partSqft,
  advanceLabel,
  balanceLabel,
  printedBuyer,
  wordsLabel,
} from "@/features/bills/model";
import { formatDocDate, formatInr, formatPlain, inrWords } from "@/features/bills/money";

function money(n: number): string {
  return `₹ ${formatInr(n)}`;
}

export function BillSheet({ bill, profile }: { bill: Bill; profile: Profile }) {
  if (bill.kind === "gst") return <GstSheet bill={bill} profile={profile} />;

  const pads = bill.kind === "quotation" ? 0 : Math.max(0, MIN_BODY_ROWS - bill.lines.length);
  const total = bill.lines.reduce((sum, line) => sum + lineAmount(line), 0);
  const advance = billAdvance(bill);
  const balance = billBalance(bill);
  const showAdvance = advance !== 0;
  const address = profile.address.split("\n").filter((line) => line.trim().length > 0);

  return (
    <article className="sheet" aria-label={`${docTitle(bill.kind)} preview`}>
      <h1 className="doc-title">{sheetTitle(bill.kind)}</h1>
      <div className="frame">
        <header className="co">
          <div className="co-main">
            <div className="co-name">{profile.name}</div>
            <div className="co-lines">
              {address.map((line, index) => (
                <div key={`${index}-${line}`}>{line}</div>
              ))}
              <div>GSTIN : {profile.gstin}</div>
              <div>Mobile : {profile.mobile}</div>
              <div>Email : {profile.email}</div>
            </div>
          </div>
          <div className="co-date">
            <div>
              {numberLabel(bill.kind)} : {bill.number.trim()}
            </div>
            <div>Date : {formatDocDate(bill.date)}</div>
          </div>
        </header>

        <div className="buyer-bar">BUYER</div>
        <div className="buyer">
          <div className="buyer-text">{printedBuyer(bill)}</div>
          <div>PHONE : {bill.phone}</div>
          <div className="state-line">
            <span>STATE : {bill.state}</span>
            <span>CODE : {bill.code}</span>
          </div>
        </div>

        <table className="items">
          <thead>
            <tr>
              <th className="c-sno">S.NO</th>
              <th className="c-desc">Description of Goods</th>
              <th className="c-qty">Quantity</th>
              <th className="c-rate">Rate</th>
              <th className="c-sq">SQ.FT</th>
              <th className="c-amt">Amount</th>
            </tr>
          </thead>
          <tbody>
            {bill.lines.map((line, index) => (
              <tr key={line.id}>
                <td className="ctr">{index + 1}</td>
                <td className="desc">
                  {line.description}
                  <SizeNotes line={line} kind={bill.kind} />
                </td>
                <td className="ctr">{line.quantity.trim() ? formatPlain(line.quantity) : ""}</td>
                <td className="num">{line.rate.trim() ? formatPlain(line.rate) : ""}</td>
                <td className="ctr">{printSq(line.sqft)}</td>
                <td className="num">{money(lineAmount(line))}</td>
              </tr>
            ))}
            {Array.from({ length: pads }, (_, index) => (
              <tr key={`pad-${index}`} className="pad">
                <td>&nbsp;</td>
                <td />
                <td />
                <td />
                <td />
                <td />
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="tot">
              <td className="lbl" colSpan={5}>
                Total value
              </td>
              <td className="amt">{money(total)}</td>
            </tr>
            {bill.kind === "invoice" ? (
              <tr className="tot gap">
                <td colSpan={5} />
                <td className="amt" />
              </tr>
            ) : null}
            <tr className="tot grand">
              <td className="lbl" colSpan={5}>
                Grand total
              </td>
              <td className="amt">{money(total)}</td>
            </tr>
            {showAdvance ? (
              <>
                <tr className="tot">
                  <td className="lbl" colSpan={5}>
                    {advanceLabel(bill.kind)}
                  </td>
                  <td className="amt">{money(advance)}</td>
                </tr>
                <tr className="tot grand">
                  <td className="lbl" colSpan={5}>
                    {balanceLabel(bill.kind)}
                  </td>
                  <td className="amt">{money(balance)}</td>
                </tr>
              </>
            ) : null}
          </tfoot>
        </table>

        <div className="words">
          <div className="words-lbl">{wordsLabel(bill.kind)}</div>
          <div className="words-val">{billWords(bill)}</div>
          {showAdvance ? (
            <>
              <div className="words-lbl balance-lbl">{balanceLabel(bill.kind)} (in words)</div>
              <div className="words-val">{inrWords(balance)}</div>
            </>
          ) : null}
        </div>

        <div className="bank">
          <div className="block-h">Company's Bank Details :</div>
          <div className="bank-grid">
            <div>Name : {profile.accountName}</div>
            <div>IFSC : {profile.ifsc}</div>
            <div>ACC no : {profile.accountNo}</div>
            <div>Branch : {profile.branch}</div>
            <div>Bank : {profile.bank}</div>
            <div />
          </div>
        </div>

        <div className="signoff">
          <div className="decl">
            <div className="block-h">Declaration :</div>
            <div className="decl-body">{declarationFor(profile, bill.kind)}</div>
          </div>
          <div className="sign">
            <div className="for-line">For {profile.name}</div>
            <div className="sign-space">
              {profile.signature ? (
                <img src={profile.signature} alt="" className="sign-img" />
              ) : null}
            </div>
            <div className="sign-label">Authorised Signatory</div>
          </div>
        </div>
      </div>
      <p className="gen-note">{footerLine(bill.kind)}</p>
    </article>
  );
}

function SizeNotes({ line, kind }: { line: Bill["lines"][number]; kind: Bill["kind"] }) {
  const parts = filledSizes(line);
  if (!parts.length) return null;
  if (kind === "quotation") {
    return (
      <div className="size-note">
        {parts.map((part) => (
          <div key={part.id}>
            {sizeLabel(part)} = {partSqft(part)} sq.ft
          </div>
        ))}
      </div>
    );
  }
  return <div className="size-note">Size : {parts.map((part) => sizeLabel(part)).join(", ")}</div>;
}
