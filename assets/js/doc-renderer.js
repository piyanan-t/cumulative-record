// ============================================================
// doc-renderer.js - Shared document render functions
// Used by both student.js (live preview) and teacher.js (view mode)
//
// Data object keys used:
//   _photoType  : 'pvs' | 'pvc'
//   _photoUrl   : base64 dataURL or null
//   _mapUrl     : base64 dataURL or null
//   friends     : array of { friend_name, friend_school, friend_phone }
//   ...all form field names
// ============================================================

function v(val, fallback='') { return val || fallback; }

function _chk(checked) {
  return `<span class="doc-chk">${checked ? '&#10003;' : ''}</span>`;
}

function _idBoxes(numStr, count) {
  const digits = (numStr || '').replace(/\D/g,'').padEnd(count,' ').split('');
  return digits.slice(0,count).map(c => `<span class="id-box">${c.trim()}</span>`).join('');
}

function _codeBoxes(str, count) {
  const chars = (str || '').split('').slice(0,count);
  const boxes = chars.map(c => `<span class="doc-cbox">${c}</span>`);
  while(boxes.length < count) boxes.push('<span class="doc-cbox"></span>');
  return boxes.join('');
}

// opts.readonly = true → no interactive toggle buttons (teacher view)
function renderDocPage1(d, opts={}) {
  const addrLine = [
    d.address_no ? 'เลขที่ ' + d.address_no : '',
    d.village_no ? 'หมู่ ' + d.village_no   : '',
    d.alley      ? 'ซ.' + d.alley           : '',
    d.road       ? 'ถ.' + d.road            : ''
  ].filter(Boolean).join(' ');

  const isPvc     = (d._photoType || 'pvs') === 'pvc';
  const codeLabel = isPvc ? 'รหัสประจำตัว (ปวช.)' : 'รหัสประจำตัว (ปวส.)';
  const codeVal   = isPvc ? (d.student_code_pvs||'') : (d.student_code||'');

  const photoToggle = opts.readonly
    ? `<div class="doc-type-label">${isPvc ? 'ปวช.' : 'ปวส.'}</div>`
    : `<div class="doc-type-toggle">
         <button type="button" class="doc-type-btn${!isPvc?' active':''}" onclick="setDocPhotoType('pvs')">ปวส.</button>
         <button type="button" class="doc-type-btn${isPvc?' active':''}" onclick="setDocPhotoType('pvc')">ปวช.</button>
       </div>`;

  return `<div class="doc-page">
    <span class="doc-page-num">1</span>

    <div class="doc-header">
      <img src="assets/img/logo.png" alt="โลโก้วิทยาลัย" class="doc-logo-img">
      <div class="doc-title">ระเบียนสะสม</div>
      <div class="doc-id-label">เลขประจำตัวประชาชน</div>
      <div class="id-boxes">
        ${_idBoxes(d.id_card_number,1)}
        <span class="id-sep">-</span>
        ${_idBoxes((d.id_card_number||'').slice(1),4)}
        <span class="id-sep">-</span>
        ${_idBoxes((d.id_card_number||'').slice(5),5)}
        <span class="id-sep">-</span>
        ${_idBoxes((d.id_card_number||'').slice(10),2)}
        <span class="id-sep">-</span>
        ${_idBoxes((d.id_card_number||'').slice(12),1)}
      </div>
    </div>

    <div class="doc-sec">1.1 ข้อมูลส่วนตัว</div>

    <div class="doc-p1-2col">
      <div class="doc-p1-photo-area">
        ${photoToggle}
        <div class="doc-photo-box-1in">
          ${d._photoUrl
            ? `<img src="${d._photoUrl}" alt="รูปถ่าย">`
            : `<span style="font-size:9px;color:#999;line-height:1.5;text-align:center">รูปถ่าย<br>1 นิ้ว</span>`}
        </div>
        <div class="doc-photo-label">${codeLabel}</div>
        <div class="doc-code-boxes">${_codeBoxes(codeVal, 10)}</div>
      </div>

      <div class="doc-p1-info">
        <div class="doc-field">
          <span class="doc-fl">ชื่อผู้เรียน</span>
          <span class="doc-fv">${v(d.prefix)}${v(d.first_name_th)} ${v(d.last_name_th)}</span>
          <span class="doc-fl" style="margin-left:10px;white-space:nowrap">ชื่อเล่น</span>
          <span class="doc-fv" style="max-width:68px">${v(d.nickname)}</span>
        </div>
        <div class="doc-inline">
          <div class="doc-if"><span class="doc-fl">เพศ</span><span class="doc-iv doc-iv-sm">${d.gender==='male'?'ชาย':d.gender==='female'?'หญิง':v(d.gender)}</span></div>
          <div class="doc-if"><span class="doc-fl">วันเดือนปีเกิด</span><span class="doc-iv doc-iv-md">${v(d.date_of_birth)}</span></div>
          <div class="doc-if"><span class="doc-fl">หมู่โลหิต</span><span class="doc-iv doc-iv-sm">${v(d.blood_type)}</span></div>
        </div>
        <div class="doc-inline">
          <div class="doc-if"><span class="doc-fl">เชื้อชาติ</span><span class="doc-iv">${v(d.race)}</span></div>
          <div class="doc-if"><span class="doc-fl">สัญชาติ</span><span class="doc-iv">${v(d.nationality)}</span></div>
          <div class="doc-if"><span class="doc-fl">ศาสนา</span><span class="doc-iv">${v(d.religion)}</span></div>
        </div>
        <div class="doc-field">
          <span class="doc-fl" style="white-space:nowrap">ภูมิลำเนาเดิม&nbsp;ที่อยู่</span>
          <span class="doc-fv">${addrLine}</span>
        </div>
        <div class="doc-inline">
          <div class="doc-if"><span class="doc-fl">ต.</span><span class="doc-iv">${v(d.subdistrict)}</span></div>
          <div class="doc-if"><span class="doc-fl">อ.</span><span class="doc-iv">${v(d.district)}</span></div>
          <div class="doc-if"><span class="doc-fl">จ.</span><span class="doc-iv">${v(d.province)}</span></div>
          <div class="doc-if"><span class="doc-fl">รหัสฯ</span><span class="doc-iv doc-iv-sm">${v(d.postal_code)}</span></div>
        </div>
        <div class="doc-inline">
          <div class="doc-if"><span class="doc-fl">โทรศัพท์</span><span class="doc-iv doc-iv-md">${v(d.phone)}</span></div>
          <div class="doc-if"><span class="doc-fl">e-mail</span><span class="doc-iv">${v(d.email)}</span></div>
        </div>
      </div>
    </div>

    <div class="doc-sib-grid">
      <div class="doc-sib-row">
        <div class="doc-if"><span class="doc-fl">มีพี่ร่วมบิดามารดา จำนวน</span><span class="doc-iv doc-iv-cnt">${v(d.siblings_same_both,'0')}</span><span class="doc-fl"> คน</span></div>
        <div class="doc-if"><span class="doc-fl">มีน้องร่วมบิดามารดา จำนวน</span><span class="doc-iv doc-iv-cnt">${v(d.siblings_younger_same_both,'0')}</span><span class="doc-fl"> คน</span></div>
      </div>
      <div class="doc-sib-row">
        <div class="doc-if"><span class="doc-fl">มีพี่ต่างบิดามารดา จำนวน</span><span class="doc-iv doc-iv-cnt">${v(d.siblings_diff_father,'0')}</span><span class="doc-fl"> คน</span></div>
        <div class="doc-if"><span class="doc-fl">มีน้องต่างบิดามารดา จำนวน</span><span class="doc-iv doc-iv-cnt">${v(d.siblings_younger_diff,'0')}</span><span class="doc-fl"> คน</span></div>
      </div>
    </div>

    <div class="doc-sec" style="margin-top:10px">1.2 ข้อมูลครอบครัว</div>
    <div class="doc-subsec">1.2.1 ข้อมูลทั่วไปของบิดามารดา</div>

    <div class="doc-fam-grid">
      <div class="doc-fam-hdr">
        <div class="doc-col-title">ข้อมูลบิดา</div>
        <div class="doc-col-title" style="padding-left:10px;border-left:1.5px solid #bbb">ข้อมูลมารดา</div>
      </div>
      <div class="doc-fam-row">
        <div class="doc-fam-cell"><span class="doc-fl">ชื่อสกุล</span><span class="doc-fv">${v(d.father_name)}</span></div>
        <div class="doc-fam-cell"><span class="doc-fl">ชื่อสกุล</span><span class="doc-fv">${v(d.mother_name)}</span></div>
      </div>
      <div class="doc-fam-row">
        <div class="doc-fam-alive">
          ${_chk(d.father_alive==='alive')}<span>มีชีวิตอยู่</span>
          ${_chk(d.father_alive==='deceased')}<span>ถึงแก่กรรมเมื่อ</span>
          <span class="doc-iv" style="flex:1;min-width:30px">${v(d.father_deceased_when)}</span>
        </div>
        <div class="doc-fam-alive">
          ${_chk(d.mother_alive==='alive')}<span>มีชีวิตอยู่</span>
          ${_chk(d.mother_alive==='deceased')}<span>ถึงแก่กรรมเมื่อ</span>
          <span class="doc-iv" style="flex:1;min-width:30px">${v(d.mother_deceased_when)}</span>
        </div>
      </div>
      <div class="doc-fam-row">
        <div class="doc-fam-cell"><span class="doc-fl">อาชีพ</span><span class="doc-fv">${v(d.father_occupation)}</span></div>
        <div class="doc-fam-cell"><span class="doc-fl">อาชีพ</span><span class="doc-fv">${v(d.mother_occupation)}</span></div>
      </div>
      <div class="doc-fam-row">
        <div class="doc-fam-cell"><span class="doc-fl">สถานที่ทำงาน</span><span class="doc-fv">${v(d.father_workplace)}</span></div>
        <div class="doc-fam-cell"><span class="doc-fl">สถานที่ทำงาน</span><span class="doc-fv">${v(d.mother_workplace)}</span></div>
      </div>
      <div class="doc-fam-row">
        <div class="doc-fam-cell"><span class="doc-fl">รายได้ต่อเดือน</span><span class="doc-fv">${v(d.father_income)}</span></div>
        <div class="doc-fam-cell"><span class="doc-fl">รายได้ต่อเดือน</span><span class="doc-fv">${v(d.mother_income)}</span></div>
      </div>
      <div class="doc-fam-row">
        <div class="doc-fam-cell"><span class="doc-fl">ระดับการศึกษาสูงสุด</span><span class="doc-fv">${v(d.father_education)}</span></div>
        <div class="doc-fam-cell"><span class="doc-fl">ระดับการศึกษาสูงสุด</span><span class="doc-fv">${v(d.mother_education)}</span></div>
      </div>
      <div class="doc-fam-row">
        <div class="doc-fam-cell"><span class="doc-fl">ที่อยู่ปัจจุบัน</span><span class="doc-fv">${v(d.father_address)}</span></div>
        <div class="doc-fam-cell"><span class="doc-fl">ที่อยู่ปัจจุบัน</span><span class="doc-fv">${v(d.mother_address)}</span></div>
      </div>
      <div class="doc-fam-row">
        <div class="doc-fam-cell"><span class="doc-fl">โทรศัพท์</span><span class="doc-fv">${v(d.father_phone)}</span></div>
        <div class="doc-fam-cell"><span class="doc-fl">โทรศัพท์</span><span class="doc-fv">${v(d.mother_phone)}</span></div>
      </div>
      <div class="doc-fam-row">
        <div class="doc-fam-cell"><span class="doc-fl">e-mail</span><span class="doc-fv">${v(d.father_email)}</span></div>
        <div class="doc-fam-cell"><span class="doc-fl">e-mail</span><span class="doc-fv">${v(d.mother_email)}</span></div>
      </div>
      <div class="doc-fam-row">
        <div class="doc-fam-cell"><span class="doc-fl">ข้อมูลอื่นๆ</span><span class="doc-fv">${v(d.father_other)}</span></div>
        <div class="doc-fam-cell"><span class="doc-fl">ข้อมูลอื่นๆ</span><span class="doc-fv">${v(d.mother_other)}</span></div>
      </div>
    </div>
    <div class="doc-note">ขอบคุณที่ให้ความร่วมมือ : แผนกแนะแนวและทะเบียน</div>
  </div>`;
}

function renderDocPage2(d) {
  const statusMap = {
    together_registered:   'บิดามารดาอยู่ร่วมกัน โดย จดทะเบียนสมรส',
    together_unregistered: 'บิดามารดาอยู่ร่วมกัน โดย ไม่ได้จดทะเบียนสมรส',
    divorced_father:       'บิดามารดาหย่าร้างกัน โดย บิดาแต่งงานใหม่',
    divorced_mother:       'บิดามารดาหย่าร้างกัน โดย มารดาแต่งงานใหม่',
    divorced_both:         'บิดามารดาหย่าร้างกัน โดย ทั้งสองแต่งงานใหม่',
  };
  return `<div class="doc-page">
    <span class="doc-page-num">2</span>
    <div class="doc-sec">1.2.2 ข้อมูลสถานภาพการอยู่ร่วมกันของบิดามารดา</div>
    <div class="doc-checks">
      ${Object.entries(statusMap).map(([k,label]) => `
        <div class="doc-check-row">${_chk(d.parent_status===k)} ${label}</div>
      `).join('')}
      <div class="doc-field" style="margin-top:6px"><span class="doc-fl">ระยะเวลา/รายละเอียด:</span><span class="doc-fv">${v(d.parent_status_detail)}</span></div>
    </div>

    <div class="doc-sec">1.3 ที่อยู่ปัจจุบันและบุคคลที่ผู้เรียนขอรับการปรึกษา</div>
    <div class="doc-2col">
      <div>
        <div class="doc-col-title">ที่อยู่ปัจจุบันของผู้เรียน</div>
        <div class="doc-field"><span class="doc-fl">ที่อยู่</span><span class="doc-fv">${v(d.current_address)}</span></div>
        <div class="doc-field" style="height:18px"><span class="doc-fv"></span></div>
        <div class="doc-field"><span class="doc-fl">โทรศัพท์</span><span class="doc-fv">${v(d.current_phone)}</span></div>
        <div class="doc-field"><span class="doc-fl">E-Mail</span><span class="doc-fv">${v(d.current_email)}</span></div>
        <div class="doc-field"><span class="doc-fl">ประเภทของที่อยู่</span><span class="doc-fv">${v(d.address_type)}</span></div>
        <div class="doc-field"><span class="doc-fl">สถานที่ใกล้เคียง</span><span class="doc-fv">${v(d.nearby_place)}</span></div>
        <div class="doc-field"><span class="doc-fl">อาศัยอยู่กับ</span><span class="doc-fv">${v(d.living_with)}</span></div>
        <div class="doc-field"><span class="doc-fl">ความเกี่ยวข้อง</span><span class="doc-fv">${v(d.living_relation)}</span></div>
      </div>
      <div>
        <div class="doc-col-title">ข้อมูลผู้ปกครอง</div>
        <div class="doc-field"><span class="doc-fl">ชื่อ-สกุล</span><span class="doc-fv">${v(d.guardian_name)}</span></div>
        <div class="doc-field"><span class="doc-fl">อาชีพ</span><span class="doc-fv">${v(d.guardian_occupation)}</span></div>
        <div class="doc-field"><span class="doc-fl">สถานที่ทำงาน</span><span class="doc-fv">${v(d.guardian_workplace)}</span></div>
        <div class="doc-field"><span class="doc-fl">ระดับการศึกษาสูงสุด</span><span class="doc-fv">${v(d.guardian_education)}</span></div>
        <div class="doc-field"><span class="doc-fl">ที่อยู่ปัจจุบัน</span><span class="doc-fv">${v(d.guardian_address)}</span></div>
        <div class="doc-field" style="height:18px"><span class="doc-fv"></span></div>
        <div class="doc-field"><span class="doc-fl">โทรศัพท์</span><span class="doc-fv">${v(d.guardian_phone)}</span></div>
        <div class="doc-field"><span class="doc-fl">E-Mail</span><span class="doc-fv">${v(d.guardian_email)}</span></div>
      </div>
    </div>

    <div class="doc-col-title" style="margin-top:14px;border-top:1px solid #000;padding-top:10px">บุคคลที่ผู้เรียนขอรับการปรึกษา (นอกวิทยาลัยฯ)</div>
    <div class="doc-field"><span class="doc-fl">ชื่อ-สกุล</span><span class="doc-fv" style="flex:2">${v(d.counselor_name)}</span><span class="doc-fl" style="white-space:nowrap;margin-left:10px">ความเกี่ยวข้อง</span><span class="doc-fv">${v(d.counselor_relation)}</span></div>
    <div class="doc-field"><span class="doc-fl">ที่อยู่</span><span class="doc-fv">${v(d.counselor_address)}</span></div>
    <div class="doc-field"><span class="doc-fl">รหัสไปรษณีย์</span><span class="doc-fv" style="min-width:70px">${v(d.counselor_postal)}</span><span class="doc-fl">โทรศัพท์</span><span class="doc-fv">${v(d.counselor_phone)}</span></div>
  </div>`;
}

function renderDocPage3(d) {
  const friends = d.friends || [];
  const rows = [...friends];
  while (rows.length < 8) rows.push(null);
  return `<div class="doc-page">
    <span class="doc-page-num">3</span>
    <div class="doc-sec">1.4 ข้อมูลเพื่อนสนิทของผู้เรียน</div>
    <table class="doc-friends">
      <thead>
        <tr>
          <th>ชื่อ-สกุล เพื่อนสนิท</th>
          <th>สถานศึกษา/ชั้น/ห้อง</th>
          <th>ที่อยู่หมายเลขโทรศัพท์</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(f => f
          ? `<tr><td>${f.friend_name}</td><td>${f.friend_school}</td><td>${f.friend_phone}</td></tr>`
          : `<tr class="empty-row"><td></td><td></td><td></td></tr>`
        ).join('')}
      </tbody>
    </table>
    <div class="doc-note">ขอบคุณที่ให้ความร่วมมือ : แผนกแนะแนวและห้องสมุด</div>

    <div class="doc-sec" style="margin-top:16px">2. ข้อมูลด้านสุขภาพ</div>
    <div class="doc-subsec">2.1 ประวัติการเจ็บป่วย</div>
    <div class="doc-field"><span class="doc-fl">2.1.1 โรคประจำตัว</span><span class="doc-fv">${v(d.chronic_disease)}</span></div>
    <div class="doc-field"><span class="doc-fl">2.1.2 โรคที่เคยเป็น</span><span class="doc-fv">${v(d.past_disease)}</span></div>
    <div class="doc-field"><span class="doc-fl">2.1.3 อาหาร/สาร/ยาที่แพ้</span><span class="doc-fv">${v(d.allergy)}</span></div>
    <div class="doc-field"><span class="doc-fl">2.1.4 การผ่าตัดและอุบัติเหตุร้ายแรง</span><span class="doc-fv">${v(d.surgery_history)}</span></div>

    <div class="doc-subsec">2.2 การตรวจสายตา การได้ยิน และช่องปาก</div>
    <div class="doc-field"><span class="doc-fl">2.2.1 สภาพสายตา</span><span class="doc-fv">${v(d.vision_condition)}</span></div>
    <div class="doc-field"><span class="doc-fl">2.2.2 สภาพการได้ยิน</span><span class="doc-fv">${v(d.hearing_condition)}</span></div>
    <div class="doc-field"><span class="doc-fl">2.2.3 สภาพฟันและสุขภาพช่องปาก</span><span class="doc-fv">${v(d.dental_condition)}</span></div>

    <div class="doc-subsec">2.3 พฤติกรรมและอาการทางจิตเวช</div>
    <div style="min-height:56px;border-bottom:1px dotted #666;color:#1d4ed8;font-size:12px;padding:4px">${v(d.mental_behavior)}</div>
  </div>`;
}

function renderDocPage4(d) {
  return `<div class="doc-page">
    <span class="doc-page-num">4</span>
    <div class="doc-sec">3. ความสามารถพิเศษของผู้เรียน</div>
    <div style="min-height:70px;border-bottom:1px dotted #666;color:#1d4ed8;font-size:12px;padding:4px;margin-bottom:6px">${v(d.special_abilities)}</div>
    <div style="border-bottom:1px dotted #666;height:20px"></div>
    <div style="border-bottom:1px dotted #666;height:20px"></div>

    <div class="doc-sec" style="margin-top:16px">4. แผนที่แสดงการเดินทางจากบ้านมาวิทยาลัยฯ</div>
    <div class="doc-map">
      ${d._mapUrl
        ? `<img src="${d._mapUrl}" alt="แผนที่" style="width:100%;height:100%;object-fit:contain">`
        : '<span style="color:#999;font-size:11px">ยังไม่มีข้อมูลแผนที่</span>'}
    </div>
    <div class="doc-note">ขอบคุณที่ให้ความร่วมมือ : แผนกแนะแนวและห้องสมุด</div>
  </div>`;
}
