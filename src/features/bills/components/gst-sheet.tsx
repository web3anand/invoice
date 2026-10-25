import {
  type Bill,
  type Profile,
  copyLabel,
  declarationFor,
  gstTotals,
  lineAmount,
  printSq,
  splitBuyer,
} from "@/features/bills/model";
import {
  formatGstDate,
  formatGstMoney,
  formatGstTax,
  formatInr,
  formatPlain,
  inrWords,
} from "@/features/bills/money";

/**
 * The tax invoice is a faithful A4 layout of the company's original Excel
 * invoice: same frame, columns, green header and tax rows. Keep the invoice
 * paper white even though the app chrome around it is dark.
 */
export function GstSheet({ bill, profile }: { bill: Bill; profile: Profile }) {
  const totals = gstTotals(bill);
  const pads = Math.max(0, 14 - bill.lines.length);
  const address = profile.address.split("\n").filter((line) => line.trim().length > 0);
  const buyer = splitBuyer(bill.buyer);
  const buyerName = bill.customerName.trim() || buyer.name;
  const buyerAddress = bill.customerName.trim() ? bill.buyer.trim() : buyer.address;
  const buyerDense = buyerAddress.includes("\n") || buyerAddress.length > 80;
  const destination = bill.destination.trim() || bill.state.trim() || "—";

  return (
    <article className="sheet gst-sheet" aria-label="GST tax invoice preview">
      <div className="gst-copy">{copyLabel(bill.copyType)}</div>
      <h1 className="gst-title">TAX INVOICE</h1>

      <div className="gst-frame">
        <header className="gst-company">
          <div className="gst-company-main">
            <div className="gst-company-name">{profile.name}</div>
            <div className="gst-company-lines">
              {address.map((line, index) => (
                <div key={`${index}-${line}`}>{line}</div>
              ))}
              <div>GSTIN : {profile.gstin}</div>
              <div>Mobile : {profile.mobile}</div>
              <div>Email : {profile.email}</div>
            </div>
          </div>
          <div className="gst-meta">
            <div className="gst-meta-row">
              <span>Invoice No</span>
              <span>: {bill.number.trim()}</span>
            </div>
            <div className="gst-meta-row">
              <span>Date</span>
              <span>: {formatGstDate(bill.date)}</span>
            </div>
            <div className="gst-meta-row">
              <span>Destination</span>
              <span>: {destination}</span>
            </div>
            <div className="gst-meta-row gst-meta-vehicle">
              <span>Vehicle No</span>
              <span>: {bill.vehicleNumber.trim()}</span>
            </div>
          </div>
        </header>

        <div className="gst-buyer-bar">BUYER</div>
        <section className={`gst-buyer${buyerDense ? " gst-buyer-dense" : ""}`}>
          <div className="gst-buyer-row gst-buyer-name">
            <span>Name</span>
            <span>: {buyerName}</span>
          </div>
          <div className="gst-buyer-row gst-buyer-address">
            <span>Address</span>
            <span>: {buyerAddress}</span>
          </div>
          <div className="gst-buyer-row gst-buyer-gstin">
            <span>GSTIN</span>
            <span>: {bill.buyerGstin.trim()}</span>
          </div>
          <div className="gst-buyer-row gst-buyer-phone">
            <span>Phone</span>
            <span>: {bill.phone.trim()}</span>
          </div>
          <div className="gst-buyer-state">
            <span>State</span>
            <span>: {bill.state}</span>
            <span>CODE : {bill.code}</span>
          </div>
        </section>

        <div className="gst-table-gap" />

        <table className="gst-items">
          <colgroup>
            <col className="gst-col-sno" />
            <col className="gst-col-desc" />
            <col className="gst-col-hsn" />
            <col className="gst-col-qty" />
            <col className="gst-col-rate" />
            <col className="gst-col-sq" />
            <col className="gst-col-amt" />
          </colgroup>
          <thead>
            <tr>
              <th>S.NO</th>
              <th>Description of Goods</th>
              <th>HSN/SAC</th>
              <th>Quantity</th>
              <th>Rate</th>
              <th>SQ.FT</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {bill.lines.map((line, index) => (
              <tr key={line.id}>
                <td className="gst-ctr">{index + 1}</td>
                <td className="gst-desc">{line.description}</td>
                <td className="gst-ctr">{line.hsn.trim()}</td>
                <td className="gst-ctr">{line.quantity.trim() ? formatPlain(line.quantity) : ""}</td>
                <td className="gst-ctr">{line.rate.trim() ? formatPlain(line.rate) : ""}</td>
                <td className="gst-ctr">{printSq(line.sqft)}</td>
                <td className="gst-num">{formatGstMoney(lineAmount(line))}</td>
              </tr>
            ))}
            {Array.from({ length: pads }, (_, index) => (
              <tr key={`gst-pad-${index}`} className="gst-pad">
                <td>&nbsp;</td>
                <td />
                <td />
                <td />
                <td />
                <td />
                <td />
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="gst-total-label" colSpan={6}>
                Total
              </td>
              <td className="gst-total-value">{formatGstMoney(totals.taxable)}</td>
            </tr>
            <tr>
              <td className="gst-total-label" colSpan={6}>
                CGST 9%
              </td>
              <td className="gst-total-value">{formatGstTax(totals.cgst)}</td>
            </tr>
            <tr>
              <td className="gst-total-label" colSpan={6}>
                SGST 9%
              </td>
              <td className="gst-total-value">{formatGstTax(totals.sgst)}</td>
            </tr>
            <tr>
              <td className="gst-total-label" colSpan={6}>
                Rounded off
              </td>
              <td className="gst-total-value">{formatGstTax(totals.roundOff)}</td>
            </tr>
            <tr className="gst-grand">
              <td className="gst-total-label" colSpan={6}>
                Grand total
              </td>
              <td className="gst-total-value">{formatInr(totals.rounded)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="gst-gap" />

        <div className="gst-words">
          <div className="gst-words-label">Amount chargeable ( in words )</div>
          <div className="gst-words-value">{inrWords(totals.rounded)}</div>
        </div>

        <div className="gst-bank">
          <div className="gst-bank-title">Company&apos;s Bank Details :</div>
          <div className="gst-bank-grid">
            <div className="gst-bank-column">
              <div className="gst-bank-row">
                <span>Name</span>
                <span>: {profile.accountName}</span>
              </div>
              <div className="gst-bank-row">
                <span>ACC no</span>
                <span>: {profile.accountNo}</span>
              </div>
              <div className="gst-bank-row">
                <span>Bank</span>
                <span>: {profile.bank}</span>
              </div>
            </div>
            <div className="gst-bank-column">
              <div className="gst-bank-row">
                <span>IFSC</span>
                <span>: {profile.ifsc}</span>
              </div>
              <div className="gst-bank-row">
                <span>Branch</span>
                <span>: {profile.branch}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="gst-signoff">
          <div className="gst-declaration">
            <div className="gst-signoff-head">Declaration :</div>
            <div className="gst-declaration-body">{declarationFor(profile, bill.kind)}</div>
          </div>
          <div className="gst-signature">
            <div className="gst-signoff-head">For {profile.name}</div>
            <div className="gst-signature-space">
              {profile.signature ? (
                <img src={profile.signature} alt="" className="gst-signature-img" />
              ) : null}
            </div>
            <div className="gst-signature-label">Authorised Signatory</div>
          </div>
        </div>
      </div>

      <p className="gst-foot">This is Computer Generated Invoice</p>
    </article>
  );
}
